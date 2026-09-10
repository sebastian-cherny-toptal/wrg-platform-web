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
          workbooks: [],
          organizations: [],
          blockingErrorCount: 0,
          warningCount: 0,
        },
      },
    }),
});

describe("local workbook selection", () => {
  it("validates both workbooks without creating a database draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue(preparedResponse());
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
    fireEvent.change(inputs[1]!, { target: { files: [efsFile] } });
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/admin/historicalImports/prepare",
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toMatch(
      /historicalImports\/(commit|draft)$/u,
    );
  });

  it("refreshes Zoho organizations between Steps 2 and 3", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("/historicalImports/prepare")
          ? preparedResponse({
              programName: "Program 2026",
              zohoProgramId: "zoho-program-1",
            })
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
    fireEvent.change(inputs[1]!, {
      target: { files: [new File(["efs"], "efs.xlsx")] },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/zoho/programs/zoho-program-1/organizations"),
      expect.any(Object),
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          organizationPrograms: [
            expect.objectContaining({
              organizationName: "Fresh Acme",
              isWinner: "Y",
              surveysSent: 125,
            }),
          ],
        }),
      }),
    );
  });

  it("requires both workbooks for a new program", () => {
    const onComplete = vi.fn();
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
    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByText("Upload both the EA and EFS workbooks."),
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
