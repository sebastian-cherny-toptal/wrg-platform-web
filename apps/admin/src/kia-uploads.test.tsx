import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomReportUploadsPage, KeyImpactAnalysisUploadsPage } from "./admin";
import { api } from "./api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("report upload pages", () => {
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

  it("uploads supported custom reports and retains download history", async () => {
    const target = {
      organizationId: "org-id",
      organizationName: "Example Co",
      organizationProgramId: "enrollment-id",
      programId: "program-id",
      programName: "Best Places",
      programYear: 2026,
      projectId: "project-id",
      projectName: "Project",
    };
    const priorUpload = {
      ...target,
      id: "custom-upload-id",
      reportName: "Board Summary",
      description: "Quarterly presentation",
      sourceFileName: "summary.pptx",
      sizeBytes: 1200,
      uploadedByUsername: "admin-user",
      uploadedAt: "2026-09-24T12:00:00Z",
    };
    vi.spyOn(api, "customReports").mockResolvedValue({
      targets: [target],
      uploads: [priorUpload],
    });
    const upload = vi.spyOn(api, "uploadCustomReport").mockResolvedValue();
    const download = vi.spyOn(api, "downloadCustomReport").mockResolvedValue();

    const { container } = render(<CustomReportUploadsPage />);

    expect(await screen.findByText("Board Summary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(priorUpload));

    fireEvent.click(
      screen.getByRole("button", { name: /Upload custom report/ }),
    );
    fireEvent.change(screen.getByLabelText("Report name"), {
      target: { value: "Detailed Results" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Full results workbook" },
    });
    const file = new File(["workbook"], "results.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const fileInput =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload report" }));

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith(
        target,
        "Detailed Results",
        "Full results workbook",
        file,
      ),
    );
  });
});
