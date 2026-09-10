import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type HistoricalImportStatus } from "./api";
import { ReviewStep } from "./historical-import";
import { LongRunningActionOverlay } from "./long-running-action-overlay";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LongRunningActionOverlay", () => {
  it("blocks the screen and warns that the action may take five minutes", () => {
    render(<LongRunningActionOverlay title="Deleting project…" />);

    const overlay = screen.getByRole("dialog", {
      name: "Deleting project…",
    });

    expect(overlay.classList.contains("long-running-action-overlay")).toBe(
      true,
    );
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("This can take up to 5 minutes.")).toBeTruthy();
  });

  it("stays visible while a project and program are being created", async () => {
    let finishCommit: (status: HistoricalImportStatus) => void = () =>
      undefined;
    vi.spyOn(api, "submitHistoricalImport").mockReturnValue(
      new Promise((resolve) => {
        finishCommit = resolve;
      }),
    );

    render(
      <MemoryRouter>
        <ReviewStep
          draft={{
            metadata: { programName: "Indiana 2026" },
          }}
          onBack={vi.fn()}
          onRestart={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Create historical program" })[0],
    );

    expect(
      screen.getByRole("dialog", { name: "Creating project and program…" }),
    ).toBeTruthy();

    await act(async () => {
      finishCommit({
        importId: "import-id",
        status: "succeeded",
        metadata: { programName: "Indiana 2026" },
        projectId: "project-id",
      });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
