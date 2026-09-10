import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = {
  metadata: { programName: "Program 2026" },
};

describe("local workbook selection", () => {
  it("keeps both workbooks in frontend state without making an API request", () => {
    const fetchMock = vi.fn();
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        eaFile,
        efsFile,
        uploadsConfigured: true,
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

  it("allows an existing program to skip workbook uploads", () => {
    const onComplete = vi.fn();
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
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ uploadsConfigured: true }),
    );
  });
});
