import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  type HistoricalImportMetadata,
  type HistoricalImportStatus,
  type HistoricalImportValidationSummary,
} from "./api";
import { PageHeader, State } from "./admin";

const storageKey = "wrg-historical-import-draft";

type WizardStep = 1 | 2 | 3;

type DraftState = {
  importId: string;
  metadata: HistoricalImportMetadata;
  eaFileName?: string;
  efsFileName?: string;
  validation?: HistoricalImportValidationSummary;
};

const currentYear = new Date().getFullYear();

function readStoredDraft(): Partial<DraftState> | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Partial<DraftState>) : null;
  } catch {
    return null;
  }
}

function storeDraft(draft: Partial<DraftState>): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
}

function clearDraft(): void {
  window.sessionStorage.removeItem(storageKey);
}

function StepIndicator({
  step,
  maxStep,
  onStepChange,
}: {
  step: WizardStep;
  maxStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
}) {
  const steps = [
    { number: 1, label: "Project & Program" },
    { number: 2, label: "Upload EA/EFS" },
    { number: 3, label: "Review & Create" },
  ] as const;
  return (
    <ol className="wizard-steps">
      {steps.map((entry) => (
        <li
          key={entry.number}
          className={
            entry.number === step
              ? "wizard-step active"
              : entry.number < step
                ? "wizard-step complete"
                : "wizard-step"
          }
        >
          <button
            type="button"
            disabled={entry.number > maxStep}
            onClick={() => onStepChange(entry.number)}
          >
            <span>{entry.number}</span>
            <strong>{entry.label}</strong>
          </button>
        </li>
      ))}
    </ol>
  );
}

function IssueList({
  issues,
}: {
  issues: HistoricalImportValidationSummary["issues"];
}) {
  if (!issues.length) return null;
  return (
    <div className="issue-list">
      {issues.map((issue, index) => (
        <div
          key={`${issue.level}-${index}`}
          className={
            issue.level === "error" ? "issue-item error" : "issue-item warning"
          }
        >
          {issue.level === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function MetadataStep({
  draft,
  onSaved,
}: {
  draft: Partial<DraftState>;
  onSaved: (next: DraftState) => void;
}) {
  const [form, setForm] = useState<HistoricalImportMetadata>({
    projectName: draft.metadata?.projectName ?? "",
    programName: draft.metadata?.programName ?? "",
    programYear: draft.metadata?.programYear ?? currentYear - 1,
    projectAbbreviation: draft.metadata?.projectAbbreviation ?? "",
    employeeSurveyId: draft.metadata?.employeeSurveyId ?? "",
    employerSurveyId: draft.metadata?.employerSurveyId ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        projectName: form.projectName.trim(),
        programName: form.programName.trim(),
        programYear: form.programYear,
        ...(form.projectAbbreviation?.trim()
          ? { projectAbbreviation: form.projectAbbreviation.trim() }
          : {}),
        ...(form.employeeSurveyId?.trim()
          ? { employeeSurveyId: form.employeeSurveyId.trim() }
          : {}),
        ...(form.employerSurveyId?.trim()
          ? { employerSurveyId: form.employerSurveyId.trim() }
          : {}),
      };
      const response = draft.importId
        ? await api.updateHistoricalImportMetadata(draft.importId, payload)
        : await api.createHistoricalImport(payload);
      const nextDraft: DraftState = {
        importId: response.importId,
        metadata: response.metadata,
      };
      storeDraft(nextDraft);
      onSaved(nextDraft);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save project metadata",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="wizard-panel" onSubmit={submit}>
      <p className="wizard-copy">
        Enter the historical Project and Program details. Survey IDs are
        optional and can be used for reference only.
      </p>
      <div className="wizard-grid">
        <label>
          Project name
          <input
            value={form.projectName}
            onChange={(event) =>
              setForm({ ...form, projectName: event.target.value })
            }
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label>
          Program name
          <input
            value={form.programName}
            onChange={(event) =>
              setForm({ ...form, programName: event.target.value })
            }
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          Program year
          <input
            type="number"
            min={1900}
            max={currentYear}
            value={form.programYear}
            onChange={(event) =>
              setForm({
                ...form,
                programYear: Number(event.target.value),
              })
            }
            required
          />
        </label>
        <label>
          Project abbreviation
          <input
            value={form.projectAbbreviation ?? ""}
            onChange={(event) =>
              setForm({ ...form, projectAbbreviation: event.target.value })
            }
          />
        </label>
        <label>
          Employee survey ID
          <input
            value={form.employeeSurveyId ?? ""}
            onChange={(event) =>
              setForm({ ...form, employeeSurveyId: event.target.value })
            }
          />
        </label>
        <label>
          Employer survey ID
          <input
            value={form.employerSurveyId ?? ""}
            onChange={(event) =>
              setForm({ ...form, employerSurveyId: event.target.value })
            }
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="wizard-actions">
        <button className="primary-button compact" disabled={saving}>
          {saving ? "Saving…" : "Continue"} <ChevronRight size={16} />
        </button>
      </div>
    </form>
  );
}

function UploadStep({
  draft,
  onComplete,
  onBack,
}: {
  draft: DraftState;
  onComplete: (next: DraftState) => void;
  onBack: () => void;
}) {
  const [eaFile, setEaFile] = useState<File | null>(null);
  const [efsFile, setEfsFile] = useState<File | null>(null);
  const [validation, setValidation] =
    useState<HistoricalImportValidationSummary>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const validate = async () => {
    if (!eaFile || !efsFile) {
      setError("Upload both the EA and EFS workbooks.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api.uploadHistoricalImportWorkbooks(
        draft.importId,
        eaFile,
        efsFile,
      );
      const summary = await api.validateHistoricalImport(draft.importId);
      setValidation(summary);
      const nextDraft = {
        ...draft,
        eaFileName: eaFile.name,
        efsFileName: efsFile.name,
        validation: summary,
      };
      storeDraft(nextDraft);
      if (summary.blockingErrorCount === 0) onComplete(nextDraft);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to validate workbooks",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="wizard-panel">
      <p className="wizard-copy">
        Upload exactly one Employer Assessment workbook and one Employee
        Feedback Survey workbook. The import validates headers, respondents, and
        organization consistency across both files.
      </p>
      <div className="upload-grid">
        <label className="upload-card">
          <FileSpreadsheet size={28} />
          <strong>Employer Assessment (EA)</strong>
          <span>{eaFile?.name ?? draft.eaFileName ?? "Choose .xlsx file"}</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setEaFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="upload-card">
          <Upload size={28} />
          <strong>Employee Feedback Survey (EFS)</strong>
          <span>
            {efsFile?.name ?? draft.efsFileName ?? "Choose .xlsx file"}
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setEfsFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {validation ? (
        <>
          <div className="summary-grid">
            {validation.workbooks.map((workbook) => (
              <div className="summary-card" key={workbook.kind}>
                <strong>{workbook.kind}</strong>
                <span>{workbook.fileName}</span>
                <ul>
                  <li>{workbook.questions} questions</li>
                  <li>{workbook.organizations} organizations</li>
                  <li>{workbook.respondents} respondents</li>
                  <li>{workbook.responses} responses</li>
                </ul>
              </div>
            ))}
          </div>
          <IssueList issues={validation.issues} />
          {validation.organizations.length ? (
            <div className="table-card">
              <table aria-label="Organization reconciliation">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Workbook ID</th>
                    <th>EA respondents</th>
                    <th>EFS respondents</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.organizations.map((organization) => (
                    <tr key={organization.key}>
                      <td>{organization.displayName}</td>
                      <td>{organization.workbookOrganizationId ?? "—"}</td>
                      <td>{organization.eaRespondents}</td>
                      <td>{organization.efsRespondents}</td>
                      <td>
                        {organization.warnings.length
                          ? organization.warnings.join("; ")
                          : "Matched"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="wizard-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
          disabled={working}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="primary-button compact"
          disabled={working}
          onClick={() => void validate()}
        >
          {working ? "Validating…" : "Validate workbooks"}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  onBack,
}: {
  draft: DraftState;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<HistoricalImportStatus>();
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);

  const validation = draft.validation;
  const totals = useMemo(
    () =>
      validation?.workbooks.reduce(
        (accumulator, workbook) => ({
          questions: accumulator.questions + workbook.questions,
          organizations: Math.max(
            accumulator.organizations,
            validation.organizations.length,
          ),
          respondents: accumulator.respondents + workbook.respondents,
          responses: accumulator.responses + workbook.responses,
        }),
        { questions: 0, organizations: 0, respondents: 0, responses: 0 },
      ),
    [validation],
  );

  const commit = async () => {
    setCommitting(true);
    setError("");
    try {
      const result = await api.commitHistoricalImport(draft.importId);
      setStatus(result);
      clearDraft();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Historical import failed",
      );
      if (draft.importId) {
        void api
          .historicalImportStatus(draft.importId)
          .then((latest) => {
            if (latest.error) setError(latest.error);
          })
          .catch(() => undefined);
      }
    } finally {
      setCommitting(false);
    }
  };

  if (status?.status === "succeeded" && status.projectId) {
    return (
      <div className="wizard-panel success-panel">
        <CheckCircle2 size={42} />
        <h2>Historical project imported</h2>
        <p>
          <strong>{status.projectName ?? draft.metadata.projectName}</strong> is
          ready with one program and both closed surveys.
        </p>
        <div className="wizard-actions">
          <Link
            className="primary-button compact action-link"
            to={`/admin/projects/${status.projectId}`}
          >
            View project <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-panel">
      <p className="wizard-copy">
        Review the reconciled import summary. Committing creates one Project,
        one Program, two closed Surveys, organizations, questions, respondents,
        and responses. Report entitlements and Zoho outcomes remain unavailable.
      </p>
      <div className="review-grid">
        <div className="review-card">
          <span>Project</span>
          <strong>{draft.metadata.projectName}</strong>
        </div>
        <div className="review-card">
          <span>Program</span>
          <strong>
            {draft.metadata.programName} ({draft.metadata.programYear})
          </strong>
        </div>
        <div className="review-card">
          <span>EA workbook</span>
          <strong>{draft.eaFileName ?? "—"}</strong>
        </div>
        <div className="review-card">
          <span>EFS workbook</span>
          <strong>{draft.efsFileName ?? "—"}</strong>
        </div>
      </div>
      {totals ? (
        <div className="summary-grid">
          <div className="summary-card">
            <strong>Totals</strong>
            <ul>
              <li>{totals.questions} questions</li>
              <li>{totals.organizations} organizations</li>
              <li>{totals.respondents} respondents</li>
              <li>{totals.responses} responses</li>
            </ul>
          </div>
        </div>
      ) : null}
      {validation ? <IssueList issues={validation.issues} /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="wizard-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
          disabled={committing}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="primary-button compact"
          disabled={
            committing || !validation || validation.blockingErrorCount > 0
          }
          onClick={() => void commit()}
        >
          {committing ? "Creating project…" : "Create historical project"}
        </button>
      </div>
    </div>
  );
}

export function HistoricalImportPage() {
  const stored = readStoredDraft();
  const [step, setStep] = useState<WizardStep>(stored?.importId ? 2 : 1);
  const [draft, setDraft] = useState<Partial<DraftState>>(stored ?? {});

  useEffect(() => {
    if (!draft.importId) return;
    void api
      .historicalImportStatus(draft.importId)
      .then((status) => {
        if (status.status === "succeeded") {
          clearDraft();
          setDraft({});
          setStep(1);
        }
      })
      .catch(() => undefined);
  }, [draft.importId]);

  let content: ReactNode;
  if (step === 1) {
    content = (
      <MetadataStep
        draft={draft}
        onSaved={(next) => {
          setDraft(next);
          setStep(2);
        }}
      />
    );
  } else if (!draft.importId || !draft.metadata) {
    content = (
      <State
        title="Draft unavailable"
        message="Start again with project and program metadata."
      />
    );
  } else if (step === 2) {
    content = (
      <UploadStep
        draft={draft as DraftState}
        onComplete={(next) => {
          setDraft(next);
          setStep(3);
        }}
        onBack={() => setStep(1)}
      />
    );
  } else {
    content = (
      <ReviewStep draft={draft as DraftState} onBack={() => setStep(2)} />
    );
  }

  return (
    <>
      <PageHeader
        title="Import Historical Project"
        breadcrumb={
          <>
            <Link to="/admin/projects">Projects</Link>
            <span>|</span>
            Import Historical Project
          </>
        }
      />
      <StepIndicator
        step={step}
        maxStep={
          draft.validation ? 3 : draft.importId && draft.metadata ? 2 : 1
        }
        onStepChange={setStep}
      />
      {content}
    </>
  );
}
