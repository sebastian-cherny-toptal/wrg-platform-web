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
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type HistoricalImportMetadata,
  type HistoricalImportStatus,
  type HistoricalImportValidationSummary,
  type ProjectRecord,
  type ZohoProgramOption,
} from "./api";
import { PageHeader, State } from "./admin";
import { CatalogEditor } from "./catalog-editor";

const storageKey = "wrg-historical-import-draft";

type WizardStep = 1 | 2 | 3 | 4;

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
    { number: 3, label: "Report Store" },
    { number: 4, label: "Review & Create" },
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

type OrganizationProgramDraft = NonNullable<
  HistoricalImportMetadata["organizationPrograms"]
>[number];

function organizationProgramKey(entry: OrganizationProgramDraft): string {
  return entry.organizationProgramId ?? entry.organizationKey ?? "";
}

export function filterWinnerOrganizations(
  entries: OrganizationProgramDraft[],
  filter: string,
): OrganizationProgramDraft[] {
  const terms = filter
    .split(",")
    .map((term) => term.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (!terms.length) return entries;
  return entries
    .map((entry, index) => {
      const searchable = `${entry.organizationName ?? ""} ${organizationProgramKey(entry)}`.toLocaleLowerCase();
      const termIndex = terms.findIndex((term) => searchable.includes(term));
      return { entry, index, termIndex };
    })
    .filter(({ termIndex }) => termIndex >= 0)
    .sort(
      (left, right) =>
        left.termIndex - right.termIndex || left.index - right.index,
    )
    .map(({ entry }) => entry);
}

function WinnerMultiSelect({
  organizationPrograms,
  onChange,
}: {
  organizationPrograms: OrganizationProgramDraft[];
  onChange: (entries: OrganizationProgramDraft[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [selectedNonWinners, setSelectedNonWinners] = useState<string[]>([]);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const nonWinners = filterWinnerOrganizations(
    organizationPrograms.filter(({ isWinner }) => !isWinner),
    filter,
  );
  const winners = filterWinnerOrganizations(
    organizationPrograms.filter(({ isWinner }) => isWinner),
    filter,
  );
  const move = (keys: string[], isWinner: boolean) => {
    const moved = new Set(keys);
    onChange(
      organizationPrograms.map((entry) =>
        moved.has(organizationProgramKey(entry))
          ? { ...entry, isWinner }
          : entry,
      ),
    );
    setSelectedNonWinners([]);
    setSelectedWinners([]);
  };
  return (
    <section className="winner-multi-select">
      <strong>Winner organizations</strong>
      <span>
        Select one or more organizations, then move them between columns.
      </span>
      <label className="winner-filter">
        <span>Filter organizations</span>
        <input
          aria-label="Filter winner organizations"
          placeholder="org1, org2, org5"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <small>Separate names or IDs with commas to match any of them.</small>
      </label>
      <div className="winner-transfer">
        <label>
          <strong>Non-winners ({nonWinners.length})</strong>
          <select
            aria-label="Non-winner organizations"
            multiple
            size={Math.min(Math.max(nonWinners.length, 5), 10)}
            value={selectedNonWinners}
            onChange={(event) =>
              setSelectedNonWinners(
                Array.from(event.currentTarget.selectedOptions, ({ value }) => value),
              )
            }
          >
            {nonWinners.map((entry) => (
              <option key={organizationProgramKey(entry)} value={organizationProgramKey(entry)}>
                {entry.organizationName ?? "Organization"}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button compact" onClick={() => setSelectedNonWinners(nonWinners.map(organizationProgramKey))} disabled={!nonWinners.length}>
            Select all shown
          </button>
        </label>
        <div className="winner-transfer-actions">
          <button type="button" className="primary-button compact" onClick={() => move(selectedNonWinners, true)} disabled={!selectedNonWinners.length}>
            Move to winners <ChevronRight size={16} />
          </button>
          <button type="button" className="secondary-button compact" onClick={() => move(selectedWinners, false)} disabled={!selectedWinners.length}>
            <ChevronLeft size={16} /> Move to non-winners
          </button>
        </div>
        <label>
          <strong>Winners ({winners.length})</strong>
          <select
            aria-label="Winner organizations"
            multiple
            size={Math.min(Math.max(winners.length, 5), 10)}
            value={selectedWinners}
            onChange={(event) =>
              setSelectedWinners(
                Array.from(event.currentTarget.selectedOptions, ({ value }) => value),
              )
            }
          >
            {winners.map((entry) => (
              <option key={organizationProgramKey(entry)} value={organizationProgramKey(entry)}>
                {entry.organizationName ?? "Organization"}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button compact" onClick={() => setSelectedWinners(winners.map(organizationProgramKey))} disabled={!winners.length}>
            Select all shown
          </button>
        </label>
      </div>
      <small>
        {organizationPrograms.filter(({ isWinner }) => isWinner).length} winner{organizationPrograms.filter(({ isWinner }) => isWinner).length === 1 ? "" : "s"}{" "}
        selected
      </small>
    </section>
  );
}

function MetadataStep({
  draft,
  projects,
  zohoPrograms,
  zohoError,
  editing,
  onSaved,
}: {
  draft: Partial<DraftState>;
  projects: ProjectRecord[];
  zohoPrograms: ZohoProgramOption[];
  zohoError: string;
  editing: boolean;
  onSaved: (next: DraftState) => void;
}) {
  const [form, setForm] = useState<HistoricalImportMetadata>({
    projectId: draft.metadata?.projectId ?? projects[0]?.id,
    projectName: draft.metadata?.projectName ?? "",
    programId: draft.metadata?.programId,
    zohoProgramId: draft.metadata?.zohoProgramId,
    programName: draft.metadata?.programName ?? "",
    programYear: draft.metadata?.programYear ?? currentYear - 1,
    projectAbbreviation: draft.metadata?.projectAbbreviation ?? "",
    efsLaunchDate: draft.metadata?.efsLaunchDate ?? `${currentYear - 1}-01-01`,
    efsDeadline: draft.metadata?.efsDeadline ?? `${currentYear - 1}-12-31`,
    organizationPrograms: draft.metadata?.organizationPrograms,
    reportCatalog: draft.metadata?.reportCatalog,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualProgram, setManualProgram] = useState(
    Boolean(draft.metadata?.programName && !draft.metadata?.zohoProgramId) ||
      zohoPrograms.length === 0,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...(form.projectId
          ? { projectId: form.projectId }
          : { projectName: form.projectName?.trim() }),
        ...(form.programId ? { programId: form.programId } : {}),
        ...(form.zohoProgramId ? { zohoProgramId: form.zohoProgramId } : {}),
        programName: form.programName.trim(),
        programYear: form.programYear,
        efsLaunchDate: form.efsLaunchDate,
        efsDeadline: form.efsDeadline,
        organizationPrograms: form.organizationPrograms,
        reportCatalog: form.reportCatalog,
        ...(form.projectAbbreviation?.trim()
          ? { projectAbbreviation: form.projectAbbreviation.trim() }
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
        Select the Project that owns this program, or create a new Project, then
        enter the program schedule.
      </p>
      <div className="wizard-grid">
        <label>
          Project
          <select
            value={form.projectId ?? "new"}
            disabled={editing}
            onChange={(event) =>
              setForm({
                ...form,
                projectId:
                  event.target.value === "new" ? undefined : event.target.value,
              })
            }
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            <option value="new">Create a new project</option>
          </select>
        </label>
        {!form.projectId ? (
          <label>
            New project name
            <input
              value={form.projectName ?? ""}
              onChange={(event) =>
                setForm({ ...form, projectName: event.target.value })
              }
              required
              minLength={2}
              maxLength={120}
            />
          </label>
        ) : null}
        {editing ? (
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
        ) : (
          <>
            <label>
              Program
              <select
                aria-label="Program"
                required
                value={manualProgram ? "manual" : form.zohoProgramId ?? ""}
                onChange={(event) => {
                  if (event.target.value === "manual") {
                    setManualProgram(true);
                    setForm({
                      ...form,
                      zohoProgramId: undefined,
                      programName: "",
                    });
                    return;
                  }
                  const selected = zohoPrograms.find(
                    ({ id }) => id === event.target.value,
                  );
                  if (!selected) return;
                  setManualProgram(false);
                  setForm({
                    ...form,
                    zohoProgramId: selected.id,
                    programName: selected.name,
                    programYear: selected.year ?? form.programYear,
                    efsLaunchDate:
                      selected.efsLaunchDate?.slice(0, 10) ??
                      form.efsLaunchDate,
                    efsDeadline:
                      selected.efsDeadline?.slice(0, 10) ?? form.efsDeadline,
                  });
                }}
              >
                <option value="" disabled>
                  Choose a Zoho program
                </option>
                {zohoPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                    {program.year ? ` (${program.year})` : ""}
                  </option>
                ))}
                <option value="manual">Enter a program manually</option>
              </select>
              {zohoError ? <small>{zohoError}</small> : null}
            </label>
            {manualProgram ? (
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
            ) : null}
          </>
        )}
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
          EFS launch date
          <input
            type="date"
            value={form.efsLaunchDate}
            onChange={(event) =>
              setForm({ ...form, efsLaunchDate: event.target.value })
            }
            required
          />
        </label>
        <label>
          EFS deadline
          <input
            type="date"
            min={form.efsLaunchDate}
            value={form.efsDeadline}
            onChange={(event) =>
              setForm({ ...form, efsDeadline: event.target.value })
            }
            required
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
  const [validation, setValidation] = useState<
    HistoricalImportValidationSummary | undefined
  >(draft.validation);
  const [organizationPrograms, setOrganizationPrograms] = useState(
    draft.metadata.organizationPrograms ?? [],
  );
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const validate = async () => {
    if (!eaFile || !efsFile) {
      if (!draft.metadata.programId) {
        setError("Upload both the EA and EFS workbooks.");
        return;
      }
      setWorking(true);
      setError("");
      try {
        const metadata = await api.updateHistoricalImportMetadata(
          draft.importId,
          {
            ...draft.metadata,
            organizationPrograms,
          },
        );
        const summary = await api.validateHistoricalImport(draft.importId);
        const nextDraft = {
          ...draft,
          metadata: metadata.metadata,
          validation: summary,
        };
        storeDraft(nextDraft);
        onComplete(nextDraft);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to continue",
        );
      } finally {
        setWorking(false);
      }
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
      const nextOrganizations = summary.organizations.map((organization) => ({
        organizationKey: organization.key,
        organizationName: organization.displayName,
        surveysSent:
          organizationPrograms.find(
            ({ organizationKey }) => organizationKey === organization.key,
          )?.surveysSent ?? organization.efsRespondents,
        isWinner:
          organizationPrograms.find(
            ({ organizationKey }) => organizationKey === organization.key,
          )?.isWinner ?? false,
      }));
      setOrganizationPrograms(nextOrganizations);
      const nextDraft = {
        ...draft,
        eaFileName: eaFile.name,
        efsFileName: efsFile.name,
        validation: summary,
      };
      storeDraft(nextDraft);
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

  const continueWithSurveysSent = async () => {
    if (!validation || validation.blockingErrorCount > 0) return;
    setWorking(true);
    setError("");
    try {
      const response = await api.updateHistoricalImportMetadata(
        draft.importId,
        {
          ...draft.metadata,
          organizationPrograms,
        },
      );
      const nextDraft = { ...draft, metadata: response.metadata, validation };
      storeDraft(nextDraft);
      onComplete(nextDraft);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save Surveys Sent",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="wizard-panel">
      <p className="wizard-copy">
        Upload one Employer Assessment workbook and one Employee Feedback Survey
        workbook.{" "}
        {draft.metadata.programId
          ? "Both files are optional when only editing program details or store prices."
          : "Both files are required for a new program."}
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
      {organizationPrograms.length ? (
        <WinnerMultiSelect
          organizationPrograms={organizationPrograms}
          onChange={setOrganizationPrograms}
        />
      ) : null}
      {draft.metadata.programId &&
      organizationPrograms.length &&
      !validation?.workbooks.length ? (
        <div className="table-card">
          <table aria-label="Surveys Sent by organization">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Surveys Sent</th>
              </tr>
            </thead>
            <tbody>
              {organizationPrograms.map((entry, index) => (
                <tr
                  key={
                    entry.organizationProgramId ??
                    entry.organizationKey ??
                    index
                  }
                >
                  <td>{entry.organizationName ?? "Organization"}</td>
                  <td>
                    <input
                      className="table-number-input"
                      type="number"
                      min={0}
                      step={1}
                      value={entry.surveysSent}
                      onChange={(event) =>
                        setOrganizationPrograms((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  surveysSent: Number(event.target.value),
                                }
                              : item,
                          ),
                        )
                      }
                      aria-label={`Surveys Sent for ${entry.organizationName ?? "organization"}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
                    <th>Surveys Sent</th>
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
                        <input
                          className="table-number-input"
                          type="number"
                          min={0}
                          step={1}
                          value={
                            organizationPrograms.find(
                              ({ organizationKey }) =>
                                organizationKey === organization.key,
                            )?.surveysSent ?? organization.efsRespondents
                          }
                          onChange={(event) =>
                            setOrganizationPrograms((current) => [
                              ...current.filter(
                                ({ organizationKey }) =>
                                  organizationKey !== organization.key,
                              ),
                              {
                                organizationKey: organization.key,
                                organizationName: organization.displayName,
                                surveysSent: Number(event.target.value),
                                isWinner:
                                  current.find(
                                    ({ organizationKey }) =>
                                      organizationKey === organization.key,
                                  )?.isWinner ?? false,
                              },
                            ])
                          }
                          aria-label={`Surveys Sent for ${organization.displayName}`}
                        />
                      </td>
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
          {working
            ? "Working…"
            : !eaFile && !efsFile && draft.metadata.programId
              ? "Skip uploads"
              : "Validate workbooks"}
        </button>
        {validation?.blockingErrorCount === 0 &&
        validation.workbooks.length > 0 ? (
          <button
            type="button"
            className="primary-button compact"
            disabled={working}
            onClick={() => void continueWithSurveysSent()}
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : null}
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
          <strong>
            {status.projectName ??
              draft.metadata.projectName ??
              draft.metadata.programName}
          </strong>{" "}
          is ready.
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
        Review the program details, optional workbook data, organization survey
        counts, and Reports Store prices before saving.
      </p>
      <div className="review-grid">
        <div className="review-card">
          <span>Project</span>
          <strong>{draft.metadata.projectName ?? "Existing project"}</strong>
        </div>
        <div className="review-card">
          <span>Program</span>
          <strong>
            {draft.metadata.programName} ({draft.metadata.programYear})
          </strong>
        </div>
        <div className="review-card">
          <span>EA workbook</span>
          <strong>{draft.eaFileName ?? "Not changed"}</strong>
        </div>
        <div className="review-card">
          <span>EFS workbook</span>
          <strong>{draft.efsFileName ?? "Not changed"}</strong>
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
          {committing
            ? "Saving program…"
            : draft.metadata.programId
              ? "Save program"
              : "Create historical program"}
        </button>
      </div>
    </div>
  );
}

function CatalogStep({
  draft,
  onComplete,
  onBack,
}: {
  draft: DraftState;
  onComplete: (next: DraftState) => void;
  onBack: () => void;
}) {
  const [products, setProducts] = useState<import("./api").ReportProduct[]>(
    draft.metadata.reportCatalog ?? [],
  );
  const [loading, setLoading] = useState(!draft.metadata.reportCatalog?.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (products.length) return;
    void api
      .reportProductTemplates()
      .then(setProducts)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load products",
        ),
      )
      .finally(() => setLoading(false));
  }, [products.length]);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await api.updateHistoricalImportMetadata(
        draft.importId,
        { ...draft.metadata, reportCatalog: products },
      );
      const next = { ...draft, metadata: response.metadata };
      storeDraft(next);
      onComplete(next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save catalog",
      );
      setSaving(false);
    }
  };
  return (
    <div className="wizard-panel">
      <p className="wizard-copy">
        Set the report products and prices that every organization in this
        imported program will see. You can customize an individual organization
        later.
      </p>
      {loading ? (
        <p>Loading product options…</p>
      ) : (
        <CatalogEditor products={products} onChange={setProducts} />
      )}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="wizard-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
          disabled={saving}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="primary-button compact"
          onClick={() => void save()}
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "Continue"} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function HistoricalImportPage() {
  const { projectId: routeProjectId, programId } = useParams();
  const editing = Boolean(programId);
  const stored = editing ? null : readStoredDraft();
  const [step, setStep] = useState<WizardStep>(stored?.importId ? 2 : 1);
  const [draft, setDraft] = useState<Partial<DraftState>>(stored ?? {});
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [zohoPrograms, setZohoPrograms] = useState<ZohoProgramOption[]>([]);
  const [zohoError, setZohoError] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const availableProjects = await api.projects();
        if (!active) return;
        setProjects(availableProjects);
        if (!programId) {
          try {
            const availableZohoPrograms = await api.zohoPrograms();
            if (!active) return;
            setZohoPrograms(availableZohoPrograms);
            if (!availableZohoPrograms.length) {
              setZohoError(
                "No Zoho programs are available. You can enter one manually.",
              );
            }
          } catch {
            if (!active) return;
            setZohoError(
              "Zoho programs could not be loaded. You can enter one manually.",
            );
          }
        }
        if (programId) {
          const [program, organizations, reportCatalog] = await Promise.all([
            api.program(programId),
            api.organizations(programId),
            api.programCatalog(programId),
          ]);
          if (!active) return;
          const details = program.details ?? {};
          const datePart = (value: unknown, fallback: string) =>
            typeof value === "string" && value ? value.slice(0, 10) : fallback;
          const selectedProjectId = program.projectId ?? routeProjectId;
          const selectedProject = availableProjects.find(
            ({ id }) => id === selectedProjectId,
          );
          setDraft({
            metadata: {
              projectId: selectedProjectId,
              projectName: selectedProject?.name,
              programId: program.id,
              programName: program.name,
              programYear: program.year ?? currentYear,
              projectAbbreviation: "",
              efsLaunchDate: datePart(
                details.StartDate ?? details.startsAt,
                `${program.year ?? currentYear}-01-01`,
              ),
              efsDeadline: datePart(
                details.EndDate ?? details.endsAt,
                `${program.year ?? currentYear}-12-31`,
              ),
              reportCatalog,
              organizationPrograms: organizations.map((organization) => ({
                organizationProgramId: organization.organizationProgramId,
                organizationName: organization.name,
                surveysSent: organization.surveysSent,
                isWinner: organization.isWinner,
              })),
            },
          });
        }
      } catch (caught) {
        if (active)
          setInitialError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the wizard",
          );
      } finally {
        if (active) setLoadingInitial(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [programId, routeProjectId]);

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
  if (loadingInitial) {
    content = (
      <State
        loading
        title="Loading program wizard"
        message="Retrieving projects and program values."
      />
    );
  } else if (initialError) {
    content = <State title="Wizard unavailable" message={initialError} />;
  } else if (step === 1) {
    content = (
      <MetadataStep
        draft={draft}
        projects={projects}
        zohoPrograms={zohoPrograms}
        zohoError={zohoError}
        editing={editing}
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
  } else if (step === 3) {
    content = (
      <CatalogStep
        draft={draft as DraftState}
        onComplete={(next) => {
          setDraft(next);
          setStep(4);
        }}
        onBack={() => setStep(2)}
      />
    );
  } else {
    content = (
      <ReviewStep draft={draft as DraftState} onBack={() => setStep(3)} />
    );
  }

  return (
    <>
      <PageHeader
        title={editing ? "Edit program" : "Import Historical Program"}
        breadcrumb={
          <>
            <Link to="/admin/projects">Projects</Link>
            <span>|</span>
            {editing ? "Edit program" : "Import Historical Program"}
          </>
        }
      />
      <StepIndicator
        step={step}
        maxStep={
          draft.metadata?.reportCatalog
            ? 4
            : draft.validation
              ? 3
              : draft.importId && draft.metadata
                ? 2
                : 1
        }
        onStepChange={setStep}
      />
      {content}
    </>
  );
}
