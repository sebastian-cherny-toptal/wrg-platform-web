import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { ProgramEfsReupload } from "./program-efs-reupload";

beforeEach(() => {
  vi.spyOn(api, "latestProgramEfsJob").mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});
const review = {
  revision: "review-revision",
  saved: false,
  validation: {
    issues: [],
    blockingErrorCount: 0,
    warningCount: 0,
    workbooks: [
      {
        kind: "EFS" as const,
        fileName: "efs.xlsx",
        sha256: "sha",
        questions: 1,
        organizations: 2,
        respondents: 83,
        responses: 83,
      },
    ],
    organizations: [
      {
        key: "yolo",
        displayName: "YoloCares",
        eaRespondents: 0,
        efsRespondents: 82,
        warnings: [],
        responseChanges: {
          changed: true,
          previousRespondents: 0,
          uploadedRespondents: 82,
          previousCompleted: 0,
          uploadedCompleted: 82,
        },
      },
      {
        key: "same",
        displayName: "Unchanged",
        eaRespondents: 0,
        efsRespondents: 1,
        warnings: [],
        responseChanges: {
          changed: false,
          previousRespondents: 1,
          uploadedRespondents: 1,
        },
      },
    ],
  },
};
const queued = {
  jobId: "job-id",
  status: "PENDING" as const,
  phase: "Queued",
  respondents: 0,
  responses: 0,
  error: null,
  saved: false,
};
const succeeded = {
  ...queued,
  status: "SUCCEEDED" as const,
  phase: "Saved",
  respondents: 83,
  responses: 83,
  saved: true,
};

it("reviews all organizations and requires Save program before replacing respondents", async () => {
  const upload = vi
    .spyOn(api, "reuploadProgramEfs")
    .mockResolvedValueOnce(review);
  const start = vi
    .spyOn(api, "startProgramEfsReupload")
    .mockResolvedValue(queued);
  vi.spyOn(api, "programEfsJob").mockResolvedValue(succeeded);
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
  const file = new File(["efs"], "efs.xlsx");
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Upload and review EFS",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  expect(await screen.findByText("YoloCares")).toBeTruthy();
  expect(screen.getByText("0 → 82")).toBeTruthy();
  expect(
    screen.getByText("Unchanged", { selector: "td:first-child" }),
  ).toBeTruthy();
  expect(upload).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save program" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(start).toHaveBeenLastCalledWith("program-id", file, "review-revision");
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
});

it("changing files discards the previous review", async () => {
  vi.spyOn(api, "reuploadProgramEfs").mockResolvedValue(review);
  render(<ProgramEfsReupload programId="program-id" onSaved={vi.fn()} />);
  const input = screen.getByLabelText("New EFS respondents XLSX");
  fireEvent.change(input, {
    target: { files: [new File(["one"], "one.xlsx")] },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Upload and review EFS",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  await screen.findByRole("button", { name: "Save program" });
  fireEvent.change(input, {
    target: { files: [new File(["two"], "two.xlsx")] },
  });
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
});

it("blocks saving when organization matching or workbook validation fails", async () => {
  vi.spyOn(api, "reuploadProgramEfs").mockResolvedValue({
    ...review,
    validation: {
      ...review.validation,
      blockingErrorCount: 1,
      issues: [{ level: "error", message: "Unknown organization" }],
    },
  });
  render(<ProgramEfsReupload programId="program-id" onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [new File(["efs"], "efs.xlsx")] },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Upload and review EFS",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  const save = await screen.findByRole("button", { name: "Save program" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Unknown organization")).toBeTruthy();
});

it("keeps the file available after a failed save and requires a fresh review", async () => {
  vi.spyOn(api, "reuploadProgramEfs").mockResolvedValueOnce(review);
  vi.spyOn(api, "startProgramEfsReupload").mockRejectedValueOnce(
    new Error("The program changed. Review the EFS again."),
  );
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [new File(["efs"], "efs.xlsx")] },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Upload and review EFS",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save program" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "The program changed. Review the EFS again.",
  );
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "Upload and review EFS",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

it("shows background progress while the job runs and does not report an early success", async () => {
  vi.spyOn(api, "reuploadProgramEfs").mockResolvedValue(review);
  vi.spyOn(api, "startProgramEfsReupload").mockResolvedValue(queued);
  vi.spyOn(api, "programEfsJob").mockResolvedValue({
    ...queued,
    status: "RUNNING",
    phase: "Importing responses",
    respondents: 40,
    responses: 3600,
  });
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [new File(["efs"], "efs.xlsx")] },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Upload and review EFS",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save program" }));
  expect(
    await screen.findByText(/40 respondents and 3,600 responses imported/u),
  ).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem("efs-save:program-id")).toBe("job-id");
  expect(
    (screen.getByRole("button", { name: "Save program" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("reconnects after a page refresh and reloads program data when the saved job succeeds", async () => {
  window.sessionStorage.setItem("efs-save:program-id", "job-id");
  const status = vi.spyOn(api, "programEfsJob").mockResolvedValue(succeeded);
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(status).toHaveBeenCalledWith("program-id", "job-id");
  expect(window.sessionStorage.getItem("efs-save:program-id")).toBeNull();
});

it("shows a failed background job without claiming that the EFS was saved", async () => {
  window.sessionStorage.setItem("efs-save:program-id", "job-id");
  vi.spyOn(api, "programEfsJob").mockResolvedValue({
    ...queued,
    status: "FAILED",
    phase: "Importing responses",
    error: "Database insert failed",
  });
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Database insert failed",
  );
  expect(onSaved).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem("efs-save:program-id")).toBeNull();
});

it("discovers a job queued from another browser and shows when all organizations are saved", async () => {
  vi.mocked(api.latestProgramEfsJob).mockResolvedValue({
    ...succeeded,
    finishedAt: "2026-10-10T17:00:00.000Z",
  });
  render(<ProgramEfsReupload programId="program-id" onSaved={vi.fn()} />);
  expect(await screen.findByText(/All organizations saved/u)).toBeTruthy();
  expect(screen.getByText(/job-id/u)).toBeTruthy();
});

it("warns when a running worker stops reporting progress without claiming it failed", async () => {
  window.sessionStorage.setItem("efs-save:program-id", "job-id");
  vi.spyOn(api, "programEfsJob").mockResolvedValue({
    ...queued,
    status: "RUNNING",
    queueState: "active",
    lastProgressAt: new Date(Date.now() - 600_000).toISOString(),
  });
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  expect(
    await screen.findByText(
      /No progress has been reported for over two minutes/u,
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(onSaved).not.toHaveBeenCalled();
});

it("makes a restarted attempt waiting for worker recovery explicit", async () => {
  window.sessionStorage.setItem("efs-save:program-id", "job-id");
  vi.spyOn(api, "programEfsJob").mockResolvedValue({
    ...queued,
    attempts: 2,
    queueState: "waiting",
    phase: "Waiting for worker recovery",
  });
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  expect(
    await screen.findByText(/Attempt 2: this import restarted/u),
  ).toBeTruthy();
  expect(screen.getByText(/Waiting for worker recovery/u)).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
});
