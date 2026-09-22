import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyImpactAnalysisUploadsPage } from "./admin";
import { api } from "./api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("KIA upload history", () => {
  it("shows prior uploads beneath pending purchases and offers download and re-upload", async () => {
    const upload = {
      id: "upload-id",
      organizationId: "org-id",
      organizationName: "Example Co",
      organizationProgramId: "enrollment-id",
      programId: "program-id",
      programName: "Program",
      programYear: 2026,
      projectId: "project-id",
      projectName: "Project",
      purchasedAt: "2026-09-18T10:00:00Z",
      purchasedByUsername: "buyer",
      status: "Uploaded",
      uploadedByUsername: "admin-user",
      uploadedAt: "2026-09-20T12:00:00Z",
      sourceFileName: "kia.xlsx",
    };
    vi.spyOn(api, "pendingKeyImpactAnalyses").mockResolvedValue([]);
    vi.spyOn(api, "uploadedKeyImpactAnalyses").mockResolvedValue([upload]);
    const download = vi
      .spyOn(api, "downloadKeyImpactAnalysis")
      .mockResolvedValue();

    render(<KeyImpactAnalysisUploadsPage />);

    expect(await screen.findByText("Already Uploaded")).toBeTruthy();
    expect(screen.getByText("Example Co")).toBeTruthy();
    expect(screen.getByText("buyer")).toBeTruthy();
    expect(screen.getByText("admin-user")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Download report/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(upload));
    fireEvent.click(screen.getByRole("button", { name: /Re-upload/ }));
    expect(
      screen.getByRole("dialog", { name: "Upload Key Impact Analysis" }),
    ).toBeTruthy();
  });
});
