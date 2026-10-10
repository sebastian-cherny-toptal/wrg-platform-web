import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { ProgramEfsReupload } from "./program-efs-reupload";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

it("reviews all organizations and requires Save program before replacing respondents", async () => {
  const upload = vi
    .spyOn(api, "reuploadProgramEfs")
    .mockResolvedValueOnce(review)
    .mockResolvedValueOnce({ ...review, saved: true });
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
  const file = new File(["efs"], "efs.xlsx");
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [file] },
  });
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
  expect(upload).toHaveBeenLastCalledWith(
    "program-id",
    file,
    "review-revision",
  );
  expect(screen.queryByRole("button", { name: "Save program" })).toBeNull();
});

it("changing files discards the previous review", async () => {
  vi.spyOn(api, "reuploadProgramEfs").mockResolvedValue(review);
  render(<ProgramEfsReupload programId="program-id" onSaved={vi.fn()} />);
  const input = screen.getByLabelText("New EFS respondents XLSX");
  fireEvent.change(input, {
    target: { files: [new File(["one"], "one.xlsx")] },
  });
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
  fireEvent.click(
    screen.getByRole("button", { name: "Upload and review EFS" }),
  );
  const save = await screen.findByRole("button", { name: "Save program" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Unknown organization")).toBeTruthy();
});

it("keeps the file available after a failed save and requires a fresh review", async () => {
  vi.spyOn(api, "reuploadProgramEfs")
    .mockResolvedValueOnce(review)
    .mockRejectedValueOnce(
      new Error("The program changed. Review the EFS again."),
    );
  const onSaved = vi.fn();
  render(<ProgramEfsReupload programId="program-id" onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("New EFS respondents XLSX"), {
    target: { files: [new File(["efs"], "efs.xlsx")] },
  });
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
