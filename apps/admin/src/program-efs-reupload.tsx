import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileUp } from "lucide-react";
import { api, type ProgramEfsJob } from "./api";
import { LongRunningActionOverlay } from "./long-running-action-overlay";

export function ProgramEfsReupload({
  programId,
  onSaved,
}: {
  programId: string;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<Awaited<
    ReturnType<typeof api.reuploadProgramEfs>
  > | null>(null);
  const [action, setAction] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const storageKey = `efs-save:${programId}`;
  const [job, setJob] = useState<ProgramEfsJob | null>(() => {
    const jobId = window.sessionStorage.getItem(storageKey);
    return jobId
      ? {
          jobId,
          status: "RUNNING",
          phase: "Reconnecting to save",
          respondents: 0,
          responses: 0,
          error: null,
          saved: false,
        }
      : null;
  });
  const saving = job?.status === "PENDING" || job?.status === "RUNNING";
  const busy = action !== null || saving;
  useEffect(() => {
    if (!job?.jobId || !saving) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.programEfsJob(programId, job.jobId);
        if (!active) return;
        setJob(next);
        if (next.status === "SUCCEEDED" || next.status === "FAILED") {
          window.sessionStorage.removeItem(storageKey);
          setReview(null);
          setNotice("");
          if (next.status === "FAILED") {
            setError(
              next.error || "EFS save failed. Review the file and try again.",
            );
            return;
          }
          setFile(null);
          if (input.current) input.current.value = "";
          setNotice(
            "EFS responses were saved. Program organizations now use the uploaded respondent data.",
          );
          try {
            await onSavedRef.current();
          } catch {
            if (active)
              setError(
                "EFS was saved, but the program view could not refresh. Reload the page.",
              );
          }
          return;
        }
        setNotice("");
      } catch {
        if (!active) return;
        setNotice(
          "The save is running in the background. Reconnecting to its progress…",
        );
      }
      if (active) timer = setTimeout(() => void poll(), 3_000);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job?.jobId, programId, storageKey]);
  const preview = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || busy) return;
    setAction("preview");
    setError("");
    setNotice("");
    setReview(null);
    try {
      setReview(await api.reuploadProgramEfs(programId, file));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "EFS could not be processed",
      );
    } finally {
      setAction(null);
    }
  };
  const save = async () => {
    if (!file || !review || busy) return;
    setAction("save");
    setError("");
    try {
      const result = await api.startProgramEfsReupload(
        programId,
        file,
        review.revision,
      );
      window.sessionStorage.setItem(storageKey, result.jobId);
      setJob(result);
    } catch (caught) {
      setReview(null);
      setError(
        caught instanceof Error ? caught.message : "EFS could not be saved",
      );
    } finally {
      setAction(null);
    }
  };
  const organizations = [...(review?.validation.organizations ?? [])].sort(
    (a, b) =>
      Number(Boolean(b.responseChanges?.changed)) -
        Number(Boolean(a.responseChanges?.changed)) ||
      a.displayName.localeCompare(b.displayName),
  );
  return (
    <section
      className="program-sync-panel"
      aria-labelledby="program-efs-reupload-title"
    >
      {action === "preview" ? (
        <LongRunningActionOverlay
          title={
            action === "preview"
              ? "Comparing EFS respondents…"
              : "Saving EFS responses…"
          }
        />
      ) : null}
      {saving ? (
        <p className="program-sync-status" role="status">
          {job.phase} · {job.respondents.toLocaleString()} respondents and{" "}
          {job.responses.toLocaleString()} responses imported. This save
          continues in the background; you can return to this page to check
          progress.
        </p>
      ) : null}
      <div className="program-sync-heading">
        <div>
          <h3 id="program-efs-reupload-title">EFS respondents</h3>
          <p>
            Upload the complete EFS workbook for this program. Every respondent
            row is checked against the current data. Review the organizations
            below before saving.
          </p>
        </div>
      </div>
      <form onSubmit={(event) => void preview(event)}>
        <div className="program-sync-actions">
          <label>
            New EFS respondents XLSX
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setReview(null);
                setError("");
                setNotice("");
              }}
            />
          </label>
          <button
            type="submit"
            className="primary-button compact"
            disabled={!file || busy}
          >
            <FileUp size={16} /> Upload and review EFS
          </button>
        </div>
      </form>
      {review ? (
        <div>
          <p role="status">
            {review.validation.workbooks[0]?.respondents ?? 0} respondent rows
            processed.{" "}
            {
              organizations.filter(
                (organization) => organization.responseChanges?.changed,
              ).length
            }{" "}
            organizations changed.
          </p>
          {review.validation.issues.map((issue, index) => (
            <p
              className={
                issue.level === "error" ? "form-error" : "program-sync-status"
              }
              key={index}
            >
              {issue.message}
            </p>
          ))}
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Current respondents</th>
                  <th>Uploaded respondents</th>
                  <th>Completed surveys (current → uploaded)</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.key}>
                    <td>{organization.displayName}</td>
                    <td>
                      {organization.responseChanges?.previousRespondents ?? 0}
                    </td>
                    <td>{organization.efsRespondents}</td>
                    <td>
                      {organization.responseChanges?.previousCompleted ?? 0} →{" "}
                      {organization.responseChanges?.uploadedCompleted ?? 0}
                    </td>
                    <td>
                      {organization.responseChanges?.changed
                        ? "Changed"
                        : "Unchanged"}
                      {organization.warnings.length
                        ? ` — ${organization.warnings.join("; ")}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Save program replaces the program’s entire EFS respondent data with
            this workbook, including removing responses for organizations
            missing from the file.
          </p>
          <button
            type="button"
            className="primary-button compact"
            disabled={busy || review.validation.blockingErrorCount > 0}
            onClick={() => void save()}
          >
            Save program
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="program-sync-status" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
