import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadStep } from "./historical-import";

afterEach(cleanup);

describe("workbook validation state", () => {
  it("stays inactive after validation until either workbook changes", () => {
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

    expect(validate.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /Continue/u })).toBeNull();
  });
});
