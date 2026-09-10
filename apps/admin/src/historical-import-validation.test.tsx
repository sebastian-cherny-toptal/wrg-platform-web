import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HistoricalImportMetadata } from "./api";
import { UploadStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = {
  metadata: { programName: "Program 2026" },
};

const preparedResponse = (
  metadata: HistoricalImportMetadata = draft.metadata,
  kind: "EA" | "EFS" = "EA",
) => ({
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      success: true,
      data: {
        metadata,
        validation: {
          issues: [],
          workbooks: [
            {
              kind,
              fileName: `${kind.toLowerCase()}.xlsx`,
              sha256: kind,
              questions: kind === "EA" ? 10 : 20,
              organizations: 1,
              respondents: kind === "EA" ? 2 : 3,
              responses: kind === "EA" ? 20 : 60,
            },
          ],
          organizations: [
            {
              key: kind === "EA" ? "acme" : "beta",
              displayName: kind === "EA" ? "Acme" : "Beta",
              eaRespondents: kind === "EA" ? 2 : 0,
              efsRespondents: kind === "EFS" ? 3 : 0,
              warnings: [],
            },
          ],
          blockingErrorCount: 0,
          warningCount: 0,
        },
      },
    }),
});

describe("local workbook selection", () => {
  it("validates both workbooks without creating a database draft", async () => {
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      const body = options.body as FormData;
      return Promise.resolve(
        preparedResponse(draft.metadata, body.has("eaFile") ? "EA" : "EFS"),
      );
    });
    const onComplete = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <UploadStep
        draft={draft}
        onBack={vi.fn()}
        onComplete={onComplete}
        onRestart={vi.fn()}
      />,
    );

    const inputs =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const eaFile = new File(["ea"], "ea.xlsx");
    const efsFile = new File(["efs"], "efs.xlsx");
    fireEvent.change(inputs[0]!, { target: { files: [eaFile] } });
    await screen.findByText("10 questions");
    fireEvent.change(inputs[1]!, { target: { files: [efsFile] } });
    await screen.findByText("20 questions");
    expect(screen.getByText("Acme: Present in EA only")).toBeTruthy();
    expect(screen.getByText("Beta: Present in EFS only")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          eaFile,
          efsFile,
          uploadsConfigured: true,
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/admin/historicalImports/prepare",
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toMatch(
      /historicalImports\/(commit|draft)$/u,
    );
    const eaRequest = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const efsRequest = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(eaRequest.get("eaFile")).toBe(eaFile);
    expect(eaRequest.get("efsFile")).toBeNull();
    expect(efsRequest.get("efsFile")).toBe(efsFile);
    expect(efsRequest.get("eaFile")).toBeNull();
  });

  it("refreshes Zoho organizations between Steps 2 and 3", async () => {
    const fetchMock = vi.fn((url: string, options: RequestInit) =>
      Promise.resolve(
        url.includes("/historicalImports/prepare")
          ? preparedResponse(
              {
                programName: "Program 2026",
                zohoProgramId: "zoho-program-1",
              },
              (options.body as FormData).has("eaFile") ? "EA" : "EFS",
            )
          : {
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  success: true,
                  data: [
                    {
                      organizationId: "49",
                      organizationName: "Fresh Acme",
                      isWinner: "Y",
                      surveysSent: 125,
                      stage: "Qualified",
                      companySize: 30,
                      employeesCount: 125,
                      currentZohoCategory: "Small",
                      reportCategory: "25-99",
                      overallRank: "4",
                      categoryRank: "2",
                    },
                  ],
                }),
            },
      ),
    );
    const onComplete = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <UploadStep
        draft={{
          metadata: {
            programName: "Program 2026",
            zohoProgramId: "zoho-program-1",
          },
        }}
        onBack={vi.fn()}
        onComplete={onComplete}
        onRestart={vi.fn()}
      />,
    );
    const inputs =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[0]!, {
      target: { files: [new File(["ea"], "ea.xlsx")] },
    });
    await screen.findByText("10 questions");
    fireEvent.change(inputs[1]!, {
      target: { files: [new File(["efs"], "efs.xlsx")] },
    });
    await screen.findByText("20 questions");
    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/zoho/programs/zoho-program-1/organizations"),
      expect.any(Object),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          organizationPrograms: expect.arrayContaining([
            expect.objectContaining({
              organizationName: "Fresh Acme",
              isWinner: "Y",
              surveysSent: 125,
            }),
          ]),
        }),
      }),
    );
  });

  it("requires both workbooks for a new program", async () => {
    const onComplete = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(preparedResponse()));
    const { container } = render(
      <UploadStep
        draft={draft}
        onBack={vi.fn()}
        onComplete={onComplete}
        onRestart={vi.fn()}
      />,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["ea"], "ea.xlsx")] },
    });
    await screen.findByText("10 questions");
    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Upload both the EA and EFS workbooks, or leave both empty.",
      ),
    ).toBeTruthy();
  });

  it("allows an existing program to skip workbook uploads", async () => {
    const onComplete = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          preparedResponse({ programId: "program-id", programName: "Program" }),
        ),
    );
    render(
      <UploadStep
        draft={{
          metadata: { programId: "program-id", programName: "Program" },
        }}
        onBack={vi.fn()}
        onComplete={onComplete}
        onRestart={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /Skip uploads/u })[0]!,
    );
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ uploadsConfigured: true }),
      ),
    );
  });
});
