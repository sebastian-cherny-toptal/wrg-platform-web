import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = {
  importId: "import-id",
  metadata: { programName: "Program 2026" },
};

describe("workbook validation state", () => {
  it("shows a workbook summary as soon as that file is uploaded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            importId: "import-id",
            workbook: {
              kind: "EA",
              fileName: "ea.xlsx",
              sha256: "abc123",
              questions: 12,
              organizations: 4,
              respondents: 20,
              responses: 240,
            },
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <UploadStep
        draft={draft}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const eaInput =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(eaInput, {
      target: { files: [new File(["workbook"], "ea.xlsx")] },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("12 questions")).toBeTruthy();
    expect(screen.getByText("4 organizations")).toBeTruthy();
    expect(screen.getByText("20 respondents")).toBeTruthy();
    expect(screen.getByText("240 responses")).toBeTruthy();
  });

  it("shows a long-running indicator while validation is pending", async () => {
    const uploadResponse = (kind: "EA" | "EFS") => ({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            importId: "import-id",
            workbook: {
              kind,
              fileName: `${kind.toLowerCase()}.xlsx`,
              sha256: kind,
              questions: 1,
              organizations: 1,
              respondents: 1,
              responses: 1,
            },
          },
        }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(uploadResponse("EA"))
      .mockResolvedValueOnce(uploadResponse("EFS"))
      .mockImplementation(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <UploadStep
        draft={draft}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const fileInputs =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[0]!, {
      target: { files: [new File(["ea"], "ea.xlsx")] },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fileInputs[1]!.disabled).toBe(false));
    fireEvent.change(fileInputs[1]!, {
      target: { files: [new File(["efs"], "efs.xlsx")] },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (
          screen.getAllByRole("button", {
            name: "Validate workbooks",
          })[0] as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Validate workbooks" })[0]!,
    );

    expect(
      screen.getByRole("dialog", { name: "Validating workbooks…" }),
    ).toBeTruthy();
  });

  it("stays inactive after validation until either workbook changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              importId: "import-id",
              workbook: {
                kind: "EA",
                fileName: "ea-new.xlsx",
                sha256: "new",
                questions: 1,
                organizations: 1,
                respondents: 1,
                responses: 1,
              },
            },
          }),
      }),
    );
    const { container } = render(
      <UploadStep
        draft={{
          importId: "import-id",
          eaFileName: "ea.xlsx",
          efsFileName: "efs.xlsx",
          metadata: { programName: "Program 2026" },
          validation: {
            issues: [],
            blockingErrorCount: 0,
            warningCount: 0,
            organizations: [],
            workbooks: [
              {
                kind: "EA",
                fileName: "ea.xlsx",
                sha256: "abc123",
                questions: 0,
                organizations: 0,
                respondents: 0,
                responses: 0,
              },
            ],
          },
        }}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const validate = screen.getAllByRole("button", {
      name: "Validate workbooks",
    })[0] as HTMLButtonElement;
    expect(validate.disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: /Continue/u }).length).toBe(2);

    const fileInputs =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[0]!, {
      target: { files: [new File(["changed"], "ea-new.xlsx")] },
    });

    await waitFor(() => expect(validate.disabled).toBe(false));
    expect(screen.queryByRole("button", { name: /Continue/u })).toBeNull();
  });
});
