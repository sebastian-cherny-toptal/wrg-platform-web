import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SearchableSelect } from "@wrg/platform-ui";
import {
  api,
  type CategoryPricing,
  type HistoricalImportMetadata,
  type HistoricalImportStatus,
  type HistoricalImportValidationSummary,
  type ProjectRecord,
  type WinnerStatus,
  type ZohoOrganizationInfo,
  type ZohoProgramOption,
} from "./api";
import { PageHeader, State } from "./admin";
import { CatalogEditor, MoneyInput } from "./catalog-editor";
import { LongRunningActionOverlay } from "./long-running-action-overlay";

type WizardStep = 1 | 2 | 3 | 4 | 5;

type DraftState = {
  metadata: HistoricalImportMetadata;
  eaFile?: File;
  efsFile?: File;
  validation?: HistoricalImportValidationSummary;
  uploadsConfigured?: boolean;
  winnersConfigured?: boolean;
};

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
          className={`issue-item ${issue.level}`}
        >
          <AlertTriangle size={16} />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

type WorkbookKind = "EA" | "EFS";

export function combineWorkbookPreviews(
  previews: Partial<Record<WorkbookKind, HistoricalImportValidationSummary>>,
): HistoricalImportValidationSummary | undefined {
  const ea = previews.EA;
  const efs = previews.EFS;
  if (!ea && !efs) return undefined;

  const organizations = new Map<
    string,
    HistoricalImportValidationSummary["organizations"][number]
  >();
  for (const organization of ea?.organizations ?? []) {
    organizations.set(organization.key, {
      ...organization,
      efsRespondents: 0,
      warnings: [],
    });
  }
  for (const organization of efs?.organizations ?? []) {
    const existing = organizations.get(organization.key);
    organizations.set(organization.key, {
      ...organization,
      ...(existing?.workbookOrganizationId
        ? { workbookOrganizationId: existing.workbookOrganizationId }
        : {}),
      displayName: existing?.displayName ?? organization.displayName,
      eaRespondents: existing?.eaRespondents ?? 0,
      warnings: [],
    });
  }

  const mismatchIssues: HistoricalImportValidationSummary["issues"] = [];
  if (ea && efs) {
    const eaKeys = new Set(ea.organizations.map(({ key }) => key));
    const efsKeys = new Set(efs.organizations.map(({ key }) => key));
    for (const organization of organizations.values()) {
      const warning = !efsKeys.has(organization.key)
        ? "Present in EA only"
        : !eaKeys.has(organization.key)
          ? "Present in EFS only"
          : undefined;
      if (!warning) continue;
      organization.warnings = [warning];
      mismatchIssues.push({
        level: "warning",
        message: `${organization.displayName}: ${warning}`,
      });
    }
  }

  const issues = [
    ...(ea?.issues ?? []),
    ...(efs?.issues ?? []),
    ...mismatchIssues,
  ];
  return {
    issues,
    workbooks: [...(ea?.workbooks ?? []), ...(efs?.workbooks ?? [])],
    organizations: [...organizations.values()],
    blockingErrorCount:
      (ea?.blockingErrorCount ?? 0) + (efs?.blockingErrorCount ?? 0),
    warningCount:
      (ea?.warningCount ?? 0) +
      (efs?.warningCount ?? 0) +
      mismatchIssues.length,
  };
}

function workbookPreviewFromCombined(
  validation: HistoricalImportValidationSummary | undefined,
  kind: WorkbookKind,
): HistoricalImportValidationSummary | undefined {
  const workbook = validation?.workbooks.find((entry) => entry.kind === kind);
  if (!validation || !workbook) return undefined;
  return {
    issues: validation.issues.filter(
      ({ message }) =>
        !message.endsWith(": Present in EA only") &&
        !message.endsWith(": Present in EFS only"),
    ),
    workbooks: [workbook],
    organizations: validation.organizations
      .filter(({ warnings }) =>
        kind === "EA"
          ? !warnings.includes("Present in EFS only")
          : !warnings.includes("Present in EA only"),
      )
      .map((organization) => ({ ...organization, warnings: [] })),
    blockingErrorCount: 0,
    warningCount: 0,
  };
}

const currentYear = new Date().getFullYear();
export const defaultCategoryPricing: CategoryPricing[] = [
  {
    tier: "Boutique",
    zohoCategoryName: "Boutique",
    employeeSize: "15-24",
    priceCents: null,
  },
  {
    tier: "Small",
    zohoCategoryName: "Small",
    employeeSize: "25-99",
    priceCents: null,
  },
  {
    tier: "Medium",
    zohoCategoryName: "Medium",
    employeeSize: "100-199",
    priceCents: null,
  },
  {
    tier: "Large",
    zohoCategoryName: "Large",
    employeeSize: "200-499",
    priceCents: null,
  },
  {
    tier: "Mega",
    zohoCategoryName: "Mega",
    employeeSize: "500-999",
    priceCents: null,
  },
  {
    tier: "Major",
    zohoCategoryName: "Major",
    employeeSize: "1,000+",
    priceCents: null,
  },
];
export function zohoCategoryNames(
  categoryPricing: CategoryPricing[] = defaultCategoryPricing,
): string[] {
  const seen = new Set<string>();
  return categoryPricing.flatMap(({ zohoCategoryName }) => {
    const name = zohoCategoryName.trim();
    const normalized = name.toLocaleLowerCase("en");
    if (!name || seen.has(normalized)) return [];
    seen.add(normalized);
    return [name];
  });
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
    { number: 3, label: "Organization Status" },
    { number: 4, label: "Report Store" },
    { number: 5, label: "Review & Create" },
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

function WizardActions({
  position,
  children,
}: {
  position: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <div className={`wizard-actions wizard-actions-${position}`}>
      {children}
    </div>
  );
}

function RestartButton({
  disabled,
  onRestart,
}: {
  disabled: boolean;
  onRestart: () => void;
}) {
  return (
    <button
      type="button"
      className="secondary-button compact restart-button"
      disabled={disabled}
      onClick={() => {
        if (
          window.confirm(
            "Restart this wizard? All information entered in this draft will be cleared.",
          )
        ) {
          onRestart();
        }
      }}
    >
      Restart
    </button>
  );
}

type OrganizationProgramDraft = NonNullable<
  HistoricalImportMetadata["organizationPrograms"]
>[number];
type ZohoWinnerOrganization = NonNullable<
  HistoricalImportMetadata["zohoWinnerOrganizations"]
>[number];

export type OrganizationParticipationStatus =
  "winner" | "non-winner" | "not-provided" | "not-included";

export function organizationParticipationStatus(
  entry: OrganizationProgramDraft,
): OrganizationParticipationStatus {
  if (entry.isIncluded === false) return "not-included";
  if (entry.isWinner === "Y") return "winner";
  if (entry.isWinner === "N") return "non-winner";
  return "not-provided";
}

export function summarizeOrganizationPrograms(
  entries: OrganizationProgramDraft[],
  categories = zohoCategoryNames(),
) {
  return {
    notIncluded: entries.filter(
      (entry) => organizationParticipationStatus(entry) === "not-included",
    ).length,
    categories: categories.map((category) => {
      const included = entries.filter(
        (entry) =>
          organizationParticipationStatus(entry) !== "not-included" &&
          entry.currentZohoCategory === category,
      );
      return {
        category,
        winners: included.filter(
          (entry) => organizationParticipationStatus(entry) === "winner",
        ).length,
        nonWinners: included.filter(
          (entry) => organizationParticipationStatus(entry) === "non-winner",
        ).length,
        total: included.length,
      };
    }),
  };
}

function organizationProgramKey(entry: OrganizationProgramDraft): string {
  return entry.organizationProgramId ?? entry.organizationKey ?? "";
}

function normalizedWinnerStatus(value: unknown): WinnerStatus | null {
  if (value === "Y" || value === true) return "Y";
  if (value === "N" || value === false) return "N";
  return null;
}

function normalizeOrganizationPrograms(
  entries: OrganizationProgramDraft[],
): OrganizationProgramDraft[] {
  return entries.map((entry) => ({
    ...entry,
    isWinner: normalizedWinnerStatus(entry.isWinner),
    isIncluded: entry.isIncluded !== false,
  }));
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
      const searchable =
        `${entry.organizationName ?? ""} ${organizationProgramKey(entry)}`.toLocaleLowerCase();
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

function normalizeOrganizationIdentity(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function filterAndSortProjects(
  projects: ProjectRecord[],
  search: string,
): ProjectRecord[] {
  const term = search.trim().toLocaleLowerCase();
  return projects
    .filter((project) => project.name.toLocaleLowerCase().includes(term))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
}

export function newProgramProjectPayload(
  selectedProject: ProjectRecord | undefined,
) {
  return {
    projectId: null,
    ...(selectedProject
      ? {
          zohoProjectId: selectedProject.externalId ?? selectedProject.id,
          projectName: selectedProject.name,
          projectAbbreviation: selectedProject.abbreviation,
        }
      : {}),
  };
}

function zohoOrganizationName(organization: ZohoOrganizationInfo): string {
  const value = organization.organizationName ?? "";
  const marker = `-${organization.organizationId.trim()}-`;
  const markerIndex = value.lastIndexOf(marker);
  if (markerIndex > 0) return value.slice(0, markerIndex).trim();
  const withoutCompositeSuffix = value.replace(/-\d{6,}-.+$/u, "").trim();
  return withoutCompositeSuffix.split(" - ")[0]?.trim() ?? "";
}

function findZohoOrganization(
  entry: OrganizationProgramDraft,
  organizations: ZohoOrganizationInfo[],
): ZohoOrganizationInfo | undefined {
  if (entry.sourceOrganizationId) {
    const byId = organizations.find(
      ({ organizationId }) =>
        organizationId.trim() === entry.sourceOrganizationId?.trim(),
    );
    if (byId) return byId;
  }
  const entryName = normalizeOrganizationIdentity(entry.organizationName);
  return organizations.find((organization) => {
    const fullName = normalizeOrganizationIdentity(
      organization.organizationName,
    );
    const splitName = normalizeOrganizationIdentity(
      zohoOrganizationName(organization),
    );
    return Boolean(
      entryName && (entryName === fullName || entryName === splitName),
    );
  });
}

export function applyZohoOrganizations(
  entries: OrganizationProgramDraft[],
  organizations: ZohoOrganizationInfo[],
): OrganizationProgramDraft[] {
  return entries.map((entry) => {
    const organization = findZohoOrganization(entry, organizations);
    if (!organization) return entry;
    return {
      ...entry,
      isIncluded: entry.isIncluded !== false,
      isWinner: organization.isWinner,
      surveysSent: organization.surveysSent,
      ...(organization.stage ? { stage: organization.stage } : {}),
      ...(organization.companySize !== null
        ? { companySize: organization.companySize }
        : {}),
      ...(organization.employeesCount !== null
        ? { employeesCount: organization.employeesCount }
        : {}),
      currentZohoCategory: organization.currentZohoCategory ?? undefined,
      reportCategory: organization.reportCategory ?? undefined,
      overallRank: organization.overallRank ?? undefined,
      categoryRank: organization.categoryRank ?? undefined,
    };
  });
}

export function organizationProgramsFromZoho(
  organizations: ZohoOrganizationInfo[],
): OrganizationProgramDraft[] {
  return organizations.map((organization) => {
    const organizationName = zohoOrganizationName(organization);
    return {
      organizationKey: `name:${normalizeOrganizationIdentity(organizationName)}`,
      sourceOrganizationId: organization.organizationId,
      organizationName,
      surveysSent: organization.surveysSent,
      isWinner: organization.isWinner,
      isIncluded: true,
      ...(organization.stage ? { stage: organization.stage } : {}),
      ...(organization.companySize !== null
        ? { companySize: organization.companySize }
        : {}),
      ...(organization.employeesCount !== null
        ? { employeesCount: organization.employeesCount }
        : {}),
      ...(organization.currentZohoCategory
        ? { currentZohoCategory: organization.currentZohoCategory }
        : {}),
      ...(organization.reportCategory
        ? { reportCategory: organization.reportCategory }
        : {}),
      ...(organization.overallRank
        ? { overallRank: organization.overallRank }
        : {}),
      ...(organization.categoryRank
        ? { categoryRank: organization.categoryRank }
        : {}),
    };
  });
}

export function refreshOrganizationProgramsFromZoho(
  entries: OrganizationProgramDraft[],
  organizations: ZohoOrganizationInfo[],
): OrganizationProgramDraft[] {
  const refreshed = applyZohoOrganizations(entries, organizations);
  const additions = organizationProgramsFromZoho(organizations).filter(
    (candidate) =>
      !refreshed.some(
        (entry) =>
          entry.sourceOrganizationId === candidate.sourceOrganizationId ||
          normalizeOrganizationIdentity(entry.organizationName) ===
            normalizeOrganizationIdentity(candidate.organizationName),
      ),
  );
  return [...refreshed, ...additions];
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
    organizationPrograms.filter(
      (entry) => organizationParticipationStatus(entry) === "non-winner",
    ),
    filter,
  );
  const winners = filterWinnerOrganizations(
    organizationPrograms.filter(
      (entry) => organizationParticipationStatus(entry) === "winner",
    ),
    filter,
  );
  const move = (keys: string[], isWinner: WinnerStatus) => {
    const moved = new Set(keys);
    onChange(
      organizationPrograms.map((entry) =>
        moved.has(organizationProgramKey(entry))
          ? { ...entry, isIncluded: true, isWinner }
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
                Array.from(
                  event.currentTarget.selectedOptions,
                  ({ value }) => value,
                ),
              )
            }
          >
            {nonWinners.map((entry) => (
              <option
                key={organizationProgramKey(entry)}
                value={organizationProgramKey(entry)}
              >
                {entry.organizationName ?? "Organization"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary-button compact"
            onClick={() =>
              setSelectedNonWinners(nonWinners.map(organizationProgramKey))
            }
            disabled={!nonWinners.length}
          >
            Select all shown
          </button>
        </label>
        <div className="winner-transfer-actions">
          <button
            type="button"
            className="primary-button compact"
            onClick={() => move(selectedNonWinners, "Y")}
            disabled={!selectedNonWinners.length}
          >
            Move to winners <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="secondary-button compact"
            onClick={() => move(selectedWinners, "N")}
            disabled={!selectedWinners.length}
          >
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
                Array.from(
                  event.currentTarget.selectedOptions,
                  ({ value }) => value,
                ),
              )
            }
          >
            {winners.map((entry) => (
              <option
                key={organizationProgramKey(entry)}
                value={organizationProgramKey(entry)}
              >
                {entry.organizationName ?? "Organization"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary-button compact"
            onClick={() =>
              setSelectedWinners(winners.map(organizationProgramKey))
            }
            disabled={!winners.length}
          >
            Select all shown
          </button>
        </label>
      </div>
      <small>
        {
          organizationPrograms.filter(
            (entry) => organizationParticipationStatus(entry) === "winner",
          ).length
        }{" "}
        winner
        {organizationPrograms.filter(
          (entry) => organizationParticipationStatus(entry) === "winner",
        ).length === 1
          ? ""
          : "s"}{" "}
        selected
      </small>
    </section>
  );
}

export function CategoryPricingEditor({
  value,
  onChange,
}: {
  value: CategoryPricing[];
  onChange: (value: CategoryPricing[]) => void;
}) {
  const update = (
    tier: CategoryPricing["tier"],
    patch: Partial<CategoryPricing>,
  ) =>
    onChange(
      value.map((entry) =>
        entry.tier === tier ? { ...entry, ...patch } : entry,
      ),
    );
  return (
    <section className="category-pricing-editor">
      <div>
        <strong>Zoho and report category configuration</strong>
        <span>
          Category names and employee-size definitions come from the selected
          Zoho program. Report prices can be adjusted for this import.
        </span>
      </div>
      <div className="category-pricing-grid">
        {!value.length ? (
          <p className="form-error">
            The selected Zoho program has no configured benchmark categories.
          </p>
        ) : null}
        {value.map((entry) => (
          <div className="category-pricing-row" key={entry.tier}>
            <div className="category-name-control">
              <span>Zoho category</span>
              <strong>{entry.zohoCategoryName}</strong>
            </div>
            <div className="category-source-field">
              <span>Zoho category size</span>
              <strong>{entry.employeeSize}</strong>
            </div>
            <label>
              Report price (USD)
              <MoneyInput
                ariaLabel={`${entry.tier} category price`}
                onChange={(priceCents) => update(entry.tier, { priceCents })}
                priceCents={entry.priceCents}
                required
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetadataStep({
  draft,
  projects,
  editing,
  onSaved,
}: {
  draft: Partial<DraftState>;
  projects: ProjectRecord[];
  editing: boolean;
  onSaved: (next: DraftState) => void;
}) {
  const [zohoPrograms, setZohoPrograms] = useState<ZohoProgramOption[]>([]);
  const [zohoError, setZohoError] = useState("");
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const abbreviationForProject = (project: ProjectRecord | undefined) =>
    project?.abbreviation ?? "";
  const initialProjectId =
    draft.metadata?.zohoProjectId ?? draft.metadata?.projectId;
  const initialProject = projects.find(({ id }) => id === initialProjectId);
  const [form, setForm] = useState<HistoricalImportMetadata>({
    projectId: initialProjectId,
    projectName: draft.metadata?.projectName ?? initialProject?.name ?? "",
    programId: draft.metadata?.programId,
    zohoProgramId: draft.metadata?.zohoProgramId,
    programName: draft.metadata?.programName ?? "",
    programYear: draft.metadata?.programYear ?? undefined,
    projectAbbreviation:
      draft.metadata?.projectAbbreviation ??
      abbreviationForProject(initialProject),
    efsLaunchDate: draft.metadata?.efsLaunchDate ?? "-",
    efsDeadline: draft.metadata?.efsDeadline ?? "-",
    organizationPrograms: draft.metadata?.organizationPrograms,
    zohoWinnerOrganizations: draft.metadata?.zohoWinnerOrganizations,
    zohoOrganizations: draft.metadata?.zohoOrganizations,
    reportCatalog: draft.metadata?.reportCatalog,
    categoryPricing:
      draft.metadata?.categoryPricing ??
      defaultCategoryPricing.map((entry) => ({ ...entry })),
  });
  const [error, setError] = useState("");
  const [manualProgram, setManualProgram] = useState(
    !editing &&
      Boolean(draft.metadata?.programName && !draft.metadata?.zohoProgramId),
  );
  const selectedProject = projects.find(({ id }) => id === form.projectId);
  const selectedZohoProjectId = selectedProject
    ? (selectedProject.externalId ?? selectedProject.id)
    : undefined;
  const availableZohoPrograms = zohoPrograms;
  const visibleProjects = filterAndSortProjects(projects, "");
  const metadataIsManual = manualProgram || !form.projectId;

  useEffect(() => {
    if (editing || !selectedZohoProjectId) {
      setZohoPrograms([]);
      setZohoError("");
      setLoadingPrograms(false);
      return;
    }
    let active = true;
    setZohoPrograms([]);
    setZohoError("");
    setLoadingPrograms(true);
    void api
      .zohoPrograms(selectedZohoProjectId)
      .then((programs) => {
        if (!active) return;
        setZohoPrograms(programs);
        if (!programs.length) {
          setZohoError(
            "No Zoho programs are available for this project. You can enter one manually.",
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setZohoError(
          "Zoho programs for this project could not be loaded. You can enter one manually.",
        );
      })
      .finally(() => {
        if (active) setLoadingPrograms(false);
      });
    return () => {
      active = false;
    };
  }, [editing, selectedZohoProjectId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const payload: HistoricalImportMetadata = {
      ...(editing
        ? form.projectId
          ? { projectId: form.projectId }
          : {}
        : newProgramProjectPayload(selectedProject)),
      ...(!form.projectId ? { projectName: form.projectName?.trim() } : {}),
      ...(form.programId ? { programId: form.programId } : {}),
      ...(form.zohoProgramId ? { zohoProgramId: form.zohoProgramId } : {}),
      programName: form.programName.trim(),
      programYear: form.programYear,
      efsLaunchDate: form.efsLaunchDate,
      efsDeadline: form.efsDeadline,
      zohoWinnerOrganizations: form.zohoWinnerOrganizations,
      zohoOrganizations: form.zohoOrganizations,
      organizationPrograms: form.organizationPrograms,
      reportCatalog: form.reportCatalog,
      categoryPricing: form.categoryPricing,
      ...(form.projectAbbreviation?.trim()
        ? { projectAbbreviation: form.projectAbbreviation.trim() }
        : {}),
    };
    onSaved({ ...draft, metadata: payload } as DraftState);
  };

  const actions = (position: "top" | "bottom") => (
    <WizardActions position={position}>
      <button className="primary-button compact" type="submit">
        Continue <ChevronRight size={16} />
      </button>
    </WizardActions>
  );

  return (
    <form className="wizard-panel" onSubmit={submit}>
      {actions("top")}
      <p className="wizard-copy">
        Select the Project that owns this program, or create a new Project, then
        enter the program schedule.
      </p>
      <div className="wizard-grid">
        <label>
          Project
          <SearchableSelect
            ariaLabel="Project"
            value={form.projectId ?? ""}
            disabled={editing}
            required
            onChange={(projectId) => {
              const project = projects.find(({ id }) => id === projectId);
              setZohoPrograms([]);
              setZohoError("");
              setManualProgram(!project);
              setForm({
                ...form,
                projectId: project?.id,
                projectName: project?.name ?? "",
                projectAbbreviation: abbreviationForProject(project),
                programId: undefined,
                zohoProgramId: undefined,
                programName: "",
                zohoWinnerOrganizations: [],
                zohoOrganizations: [],
                organizationPrograms: [],
                categoryPricing: project
                  ? []
                  : defaultCategoryPricing.map((entry) => ({ ...entry })),
              });
            }}
            options={[
              ...visibleProjects.map((project) => ({
                value: project.id,
                label: project.name,
              })),
              { value: "new", label: "Create a new project" },
            ]}
            placeholder="Choose a project"
            searchPlaceholder="Search projects…"
          />
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
              <SearchableSelect
                disabled={loadingPrograms || !selectedProject}
                required
                value={manualProgram ? "manual" : (form.zohoProgramId ?? "")}
                onChange={(programId) => {
                  if (programId === "manual") {
                    setManualProgram(true);
                    setForm({
                      ...form,
                      zohoProgramId: undefined,
                      programName: "",
                      zohoWinnerOrganizations: [],
                      zohoOrganizations: [],
                      organizationPrograms: [],
                      categoryPricing: defaultCategoryPricing.map((entry) => ({
                        ...entry,
                      })),
                    });
                    return;
                  }
                  const selected = availableZohoPrograms.find(
                    ({ id }) => id === programId,
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
                    projectAbbreviation:
                      selectedProject?.abbreviation ??
                      selected.projectAbbreviation ??
                      form.projectAbbreviation,
                    zohoWinnerOrganizations: selected.winnerOrganizations,
                    zohoOrganizations: selected.organizations,
                    organizationPrograms: organizationProgramsFromZoho(
                      selected.organizations,
                    ),
                    categoryPricing: selected.categoryPricing ?? [],
                  });
                }}
                ariaLabel="Program"
                options={[
                  ...availableZohoPrograms.map((program) => ({
                    value: program.id,
                    label: `${program.name}${program.year ? ` (${program.year})` : ""}`,
                  })),
                  {
                    value: "manual",
                    label: form.projectId
                      ? "Please select a project"
                      : "Enter a program manually",
                  },
                ]}
                placeholder={
                  loadingPrograms
                    ? "Loading programs…"
                    : "Choose a Zoho program"
                }
                searchPlaceholder="Search programs…"
              />
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
        {metadataIsManual ? (
          <>
            <label>
              Program year
              <input
                type="number"
                min={2010}
                max={currentYear + 3}
                value={form.programYear ?? ""}
                onChange={(event) =>
                  setForm({ ...form, programYear: Number(event.target.value) })
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
          </>
        ) : (
          <>
            <div className="wizard-fixed-field">
              <span>Program year</span>
              <strong>{form.programYear ? `${form.programYear}` : "—"}</strong>
            </div>
            <div className="wizard-fixed-field">
              <span>Project abbreviation</span>
              <strong>{form.projectAbbreviation || "—"}</strong>
            </div>
            <div className="wizard-fixed-field">
              <span>EFS launch date</span>
              <strong>{form.efsLaunchDate ?? "—"}</strong>
            </div>
            <div className="wizard-fixed-field">
              <span>EFS deadline</span>
              <strong>{form.efsDeadline ?? "—"}</strong>
            </div>
          </>
        )}
      </div>
      {editing || form.zohoProgramId || metadataIsManual ? (
        <CategoryPricingEditor
          onChange={(categoryPricing) => setForm({ ...form, categoryPricing })}
          value={form.categoryPricing ?? defaultCategoryPricing}
        />
      ) : (
        <section className="category-pricing-editor">
          <strong>Zoho and report category configuration</strong>
          <span>Select a Zoho program to load its category configuration.</span>
        </section>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {actions("bottom")}
    </form>
  );
}

export function UploadStep({
  draft,
  onComplete,
  onDraftChange,
  onBack,
  onRestart,
}: {
  draft: DraftState;
  onComplete: (next: DraftState) => void;
  onDraftChange?: (next: DraftState) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [eaFile, setEaFile] = useState<File | null>(draft.eaFile ?? null);
  const [efsFile, setEfsFile] = useState<File | null>(draft.efsFile ?? null);
  const eaFileRef = useRef(eaFile);
  const efsFileRef = useRef(efsFile);
  const previewRef = useRef<
    Partial<Record<WorkbookKind, HistoricalImportValidationSummary>>
  >({
    EA: workbookPreviewFromCombined(draft.validation, "EA"),
    EFS: workbookPreviewFromCombined(draft.validation, "EFS"),
  });
  const analysisRequests = useRef<Record<WorkbookKind, number>>({
    EA: 0,
    EFS: 0,
  });
  const [pendingAnalyses, setPendingAnalyses] = useState(0);
  const [validation, setValidation] = useState(draft.validation);
  const [error, setError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const working = pendingAnalyses > 0 || continuing;

  const workbookChanged = async (
    kind: "EA" | "EFS",
    setFile: (file: File | null) => void,
    file: File | null,
  ) => {
    setFile(file);
    if (kind === "EA") eaFileRef.current = file;
    else efsFileRef.current = file;
    setError("");
    previewRef.current = { ...previewRef.current, [kind]: undefined };
    const previewWithoutChangedFile = combineWorkbookPreviews(
      previewRef.current,
    );
    setValidation(previewWithoutChangedFile);
    const nextDraft = {
      ...draft,
      eaFile: eaFileRef.current ?? undefined,
      efsFile: efsFileRef.current ?? undefined,
      uploadsConfigured: false,
      validation: previewWithoutChangedFile,
    };
    onDraftChange?.(nextDraft);
    const requestId = ++analysisRequests.current[kind];
    if (!file) return;

    setPendingAnalyses((count) => count + 1);
    try {
      const prepared = await api.prepareHistoricalImport(draft.metadata, {
        ...(kind === "EA" ? { eaFile: file } : { efsFile: file }),
      });
      if (requestId !== analysisRequests.current[kind]) return;
      previewRef.current = {
        ...previewRef.current,
        [kind]: prepared.validation,
      };
      const combinedValidation = combineWorkbookPreviews(previewRef.current);
      setValidation(combinedValidation);
      onDraftChange?.({
        ...draft,
        eaFile: eaFileRef.current ?? undefined,
        efsFile: efsFileRef.current ?? undefined,
        uploadsConfigured: false,
        validation: combinedValidation,
      });
    } catch (caught) {
      if (requestId !== analysisRequests.current[kind]) return;
      setError(
        caught instanceof Error ? caught.message : "Unable to analyze workbook",
      );
    } finally {
      setPendingAnalyses((count) => Math.max(0, count - 1));
    }
  };

  const continueToOrganizations = async () => {
    if (Boolean(eaFile) !== Boolean(efsFile)) {
      setError("Upload both the EA and EFS workbooks, or leave both empty.");
      return;
    }
    if (!eaFile && !efsFile && !draft.metadata.programId) {
      setError("Upload both the EA and EFS workbooks.");
      return;
    }
    if (eaFile && efsFile && validation?.workbooks.length !== 2) {
      setError(
        "Both workbooks must be analyzed successfully before continuing.",
      );
      return;
    }
    if (validation && validation.blockingErrorCount > 0) {
      setError("Resolve the workbook validation errors before continuing.");
      return;
    }
    setContinuing(true);
    setError("");
    try {
      const preparedValidation = validation ??
        combineWorkbookPreviews(previewRef.current) ?? {
          issues: [],
          workbooks: [],
          organizations: [],
          blockingErrorCount: 0,
          warningCount: 0,
        };
      const zohoOrganizations = draft.metadata.zohoProgramId
        ? await api.zohoProgramOrganizations(draft.metadata.zohoProgramId)
        : (draft.metadata.zohoOrganizations ?? []);
      const currentOrganizations = normalizeOrganizationPrograms(
        draft.metadata.organizationPrograms ?? [],
      );
      const workbookOrganizations = preparedValidation.organizations.map(
        (organization) => {
          const current = currentOrganizations.find(
            (entry) => entry.organizationKey === organization.key,
          );
          return {
            ...current,
            organizationKey: organization.key,
            ...(organization.workbookOrganizationId
              ? { sourceOrganizationId: organization.workbookOrganizationId }
              : {}),
            organizationName: organization.displayName,
            surveysSent: current?.surveysSent ?? organization.efsRespondents,
            isWinner: current?.isWinner ?? null,
            isIncluded: current?.isIncluded ?? true,
          } satisfies OrganizationProgramDraft;
        },
      );
      const organizationPrograms = refreshOrganizationProgramsFromZoho(
        workbookOrganizations.length
          ? workbookOrganizations
          : currentOrganizations,
        zohoOrganizations,
      );
      onComplete({
        ...draft,
        eaFile: eaFile ?? undefined,
        efsFile: efsFile ?? undefined,
        uploadsConfigured: true,
        validation: preparedValidation,
        metadata: {
          ...draft.metadata,
          zohoOrganizations,
          organizationPrograms,
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load organizations from Zoho",
      );
    } finally {
      setContinuing(false);
    }
  };

  const actions = (position: "top" | "bottom") => (
    <WizardActions position={position}>
      <button
        type="button"
        className="secondary-button"
        onClick={onBack}
        disabled={working}
      >
        <ChevronLeft size={16} /> Back
      </button>
      <RestartButton disabled={working} onRestart={onRestart} />
      <button
        type="button"
        className="primary-button compact"
        disabled={working}
        onClick={() => void continueToOrganizations()}
      >
        {working
          ? "Validating and loading Zoho…"
          : !eaFile && !efsFile && draft.metadata.programId
            ? "Skip uploads"
            : "Continue"}{" "}
        <ChevronRight size={16} />
      </button>
    </WizardActions>
  );

  return (
    <div className="wizard-panel">
      {actions("top")}
      <p className="wizard-copy">
        Upload one Employer Assessment workbook and one Employee Feedback Survey
        workbook. Each file is analyzed as soon as you select it. The browser
        compares their organization lists, and Continue loads the latest program
        organizations from Zoho. You can review and adjust the combined data in
        Step 3 before anything is saved.{" "}
        {draft.metadata.programId
          ? "Both files are optional when only editing program details or store prices."
          : "Both files are required for a new program."}
      </p>
      <div className="upload-grid">
        <label className="upload-card">
          <FileSpreadsheet size={28} />
          <strong>Employer Assessment (EA)</strong>
          <span>{eaFile?.name ?? "Choose .xlsx file"}</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) =>
              void workbookChanged(
                "EA",
                setEaFile,
                event.target.files?.[0] ?? null,
              )
            }
          />
        </label>
        <label className="upload-card">
          <Upload size={28} />
          <strong>Employee Feedback Survey (EFS)</strong>
          <span>{efsFile?.name ?? "Choose .xlsx file"}</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) =>
              void workbookChanged(
                "EFS",
                setEfsFile,
                event.target.files?.[0] ?? null,
              )
            }
          />
        </label>
      </div>
      {validation?.workbooks.length ? (
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
      ) : null}
      {validation ? <IssueList issues={validation.issues} /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {actions("bottom")}
    </div>
  );
}

export function WinnersStep({
  draft,
  onComplete,
  onBack,
  onRestart,
}: {
  draft: DraftState;
  onComplete: (next: DraftState) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [organizationPrograms, setOrganizationPrograms] = useState(
    normalizeOrganizationPrograms(draft.metadata.organizationPrograms ?? []),
  );
  const [rankingSummary, setRankingSummary] = useState<{
    fileName: string;
    matchedOrganizations: number;
    unmatchedOrganizations: string[];
    invalidRows: number;
  }>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const zohoOrganizations = draft.metadata.zohoOrganizations ?? [];
  const zohoCategories = zohoCategoryNames(draft.metadata.categoryPricing);
  const sortedOrganizationPrograms = [...organizationPrograms].sort(
    (left, right) => {
      const leftMatched = Boolean(
        findZohoOrganization(left, zohoOrganizations),
      );
      const rightMatched = Boolean(
        findZohoOrganization(right, zohoOrganizations),
      );
      return (
        Number(leftMatched) - Number(rightMatched) ||
        (left.organizationName ?? "").localeCompare(
          right.organizationName ?? "",
        )
      );
    },
  );
  const organizationSummary = summarizeOrganizationPrograms(
    organizationPrograms,
    zohoCategories,
  );

  const updateOrganization = (
    key: string,
    update: Partial<OrganizationProgramDraft>,
  ) => {
    setOrganizationPrograms((current) =>
      current.map((entry) =>
        organizationProgramKey(entry) === key ? { ...entry, ...update } : entry,
      ),
    );
  };

  const uploadRankingWorkbook = async (file: File) => {
    setWorking(true);
    setError("");
    try {
      const result = await api.previewHistoricalImportRanking(
        { ...draft.metadata, organizationPrograms },
        file,
      );
      setOrganizationPrograms(
        normalizeOrganizationPrograms(result.organizationPrograms),
      );
      setRankingSummary({ fileName: file.name, ...result });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to match ranking workbook",
      );
    } finally {
      setWorking(false);
    }
  };

  const save = () => {
    onComplete({
      ...draft,
      metadata: { ...draft.metadata, organizationPrograms },
      winnersConfigured: true,
    });
  };

  const actions = (position: "top" | "bottom") => (
    <WizardActions position={position}>
      <button
        type="button"
        className="secondary-button"
        onClick={onBack}
        disabled={working}
      >
        <ChevronLeft size={16} /> Back
      </button>
      <RestartButton disabled={working} onRestart={onRestart} />
      <button
        type="button"
        className="primary-button compact"
        disabled={working || !organizationPrograms.length}
        onClick={save}
      >
        {working ? "Matching…" : "Continue"} <ChevronRight size={16} />
      </button>
    </WizardActions>
  );

  return (
    <div className="wizard-panel">
      {actions("top")}
      <p className="wizard-copy">
        Review the organization information loaded from Zoho, then adjust its
        status, Surveys Sent, or Zoho category when needed. The Zoho category
        determines the benchmark cohort. Organizations marked as not included
        remain visible but will not be imported. You can also upload a ranking
        extract for bulk updates.
      </p>
      <section className="ranking-upload">
        <div>
          <strong>Bulk winner and category matching</strong>
          <span>
            Upload the ranking extract with Alias Name, Organization ID, CY
            Winner, and CY Category columns.
          </span>
        </div>
        <label className="secondary-button compact action-link">
          <Upload size={16} /> Upload ranking extract
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={working}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadRankingWorkbook(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        {rankingSummary ? (
          <small>
            {rankingSummary.fileName}: matched{" "}
            {rankingSummary.matchedOrganizations}
            {rankingSummary.unmatchedOrganizations.length
              ? `; ${rankingSummary.unmatchedOrganizations.length} unmatched`
              : ""}
            {rankingSummary.invalidRows
              ? `; ${rankingSummary.invalidRows} rows without Yes/No`
              : ""}
            .
          </small>
        ) : null}
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      {organizationPrograms.length ? (
        <>
          <section
            className="organization-summary"
            aria-label="Organization summary"
          >
            {organizationSummary.categories.map(
              ({ category, winners, nonWinners, total }) => (
                <div key={category}>
                  <span className="organization-summary-label">{category}</span>
                  <div className="organization-summary-counts">
                    <span>
                      <strong>{winners}</strong>
                      <small>Winners</small>
                    </span>
                    <span>
                      <strong>{nonWinners}</strong>
                      <small>Non-winners</small>
                    </span>
                    <span>
                      <strong>{total}</strong>
                      <small>Total</small>
                    </span>
                  </div>
                </div>
              ),
            )}
            <div className="organization-summary-not-included">
              <strong>{organizationSummary.notIncluded}</strong>
              <span>Not included</span>
            </div>
          </section>
          <div className="table-card organization-config-table">
            <table aria-label="Organization winner, surveys, and category configuration">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Winner</th>
                  <th>EFS respondents</th>
                  <th>Surveys Sent</th>
                  <th>Report category</th>
                  <th>Zoho category (benchmark)</th>
                  <th aria-label="Inclusion actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrganizationPrograms.map((entry) => {
                  const key = organizationProgramKey(entry);
                  const matched = Boolean(
                    findZohoOrganization(entry, zohoOrganizations),
                  );
                  const status = organizationParticipationStatus(entry);
                  const validationOrganization =
                    draft.validation?.organizations.find(
                      (organization) =>
                        organization.key === entry.organizationKey,
                    );
                  const isIncluded = status !== "not-included";
                  const rowClassName =
                    [
                      matched ? "" : "zoho-unmatched-row",
                      isIncluded ? "" : "organization-not-included-row",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined;
                  return (
                    <tr className={rowClassName} key={key}>
                      <td>
                        <strong>
                          {entry.organizationName ?? "Organization"}
                        </strong>
                        {!isIncluded ? (
                          <span className="organization-not-included-message">
                            Not included
                          </span>
                        ) : null}
                        {!matched ? (
                          <span className="zoho-unmatched-message">
                            No information in Zoho for this organization
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <select
                          aria-label={`Winner for ${entry.organizationName ?? "organization"}`}
                          className="winner-status-select"
                          disabled={!isIncluded}
                          onChange={(event) =>
                            updateOrganization(key, {
                              isWinner:
                                event.target.value === "Y" ||
                                event.target.value === "N"
                                  ? event.target.value
                                  : null,
                            })
                          }
                          value={entry.isWinner ?? ""}
                        >
                          <option value="">-</option>
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>
                      <td>{validationOrganization?.efsRespondents ?? "—"}</td>
                      <td>
                        <input
                          aria-label={`Surveys Sent for ${entry.organizationName ?? "organization"}`}
                          className="table-number-input"
                          disabled={!isIncluded}
                          min={0}
                          onChange={(event) =>
                            updateOrganization(key, {
                              surveysSent: Number(event.target.value),
                            })
                          }
                          step={1}
                          type="number"
                          value={entry.surveysSent}
                        />
                      </td>
                      <td>{entry.reportCategory ?? "Not provided"}</td>
                      <td>
                        <div className="category-radio-group">
                          {zohoCategories.map((category) => (
                            <label key={category}>
                              <input
                                checked={entry.currentZohoCategory === category}
                                disabled={!isIncluded}
                                name={`category-${key}`}
                                onChange={() =>
                                  updateOrganization(key, {
                                    currentZohoCategory: category,
                                  })
                                }
                                type="radio"
                              />
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          aria-label={`${isIncluded ? "Mark" : "Unmark"} ${entry.organizationName ?? "organization"} as not included`}
                          className="icon-button organization-inclusion-button"
                          onClick={() =>
                            updateOrganization(key, { isIncluded: !isIncluded })
                          }
                          title={
                            isIncluded
                              ? "Mark organization as not included"
                              : "Include organization again"
                          }
                          type="button"
                        >
                          {isIncluded ? (
                            <Trash2 size={16} />
                          ) : (
                            <RotateCcw size={16} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="wizard-copy">
          {draft.metadata.zohoProgramId
            ? "Zoho did not return any organizations for this program. You can return to Step 2 and try loading the program again before submitting."
            : "This program is not linked to a Zoho program, so there is no Zoho organization information to review."}
        </p>
      )}
      {actions("bottom")}
    </div>
  );
}

export function ReviewStep({
  draft,
  onBack,
  onRestart,
}: {
  draft: DraftState;
  onBack: () => void;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<HistoricalImportStatus>();
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);

  const commit = async () => {
    setCommitting(true);
    setError("");
    try {
      const result = await api.submitHistoricalImport(draft.metadata, {
        eaFile: draft.eaFile,
        efsFile: draft.efsFile,
      });
      setStatus(result);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Historical import failed",
      );
    } finally {
      setCommitting(false);
    }
  };

  const actions = (position: "top" | "bottom") => (
    <WizardActions position={position}>
      <button
        type="button"
        className="secondary-button"
        onClick={onBack}
        disabled={committing}
      >
        <ChevronLeft size={16} /> Back
      </button>
      <RestartButton disabled={committing} onRestart={onRestart} />
      <button
        type="button"
        className="primary-button compact"
        disabled={committing}
        onClick={() => void commit()}
      >
        {committing
          ? "Saving program…"
          : draft.metadata.programId
            ? "Save program"
            : "Create historical program"}
      </button>
    </WizardActions>
  );

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
      {committing ? (
        <LongRunningActionOverlay
          title={
            draft.metadata.programId
              ? "Saving program…"
              : "Creating project and program…"
          }
        />
      ) : null}
      {actions("top")}
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
          <strong>{draft.eaFile?.name ?? "Not changed"}</strong>
        </div>
        <div className="review-card">
          <span>EFS workbook</span>
          <strong>{draft.efsFile?.name ?? "Not changed"}</strong>
        </div>
        <div className="review-card">
          <span>Organizations reviewed</span>
          <strong>
            {draft.metadata.organizationPrograms?.filter(
              (organization) => organization.isIncluded !== false,
            ).length ?? 0}
          </strong>
        </div>
      </div>
      {draft.validation ? <IssueList issues={draft.validation.issues} /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {actions("bottom")}
    </div>
  );
}

function CatalogStep({
  draft,
  onComplete,
  onBack,
  onRestart,
}: {
  draft: DraftState;
  onComplete: (next: DraftState) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [products, setProducts] = useState<import("./api").ReportProduct[]>(
    draft.metadata.reportCatalog ?? [],
  );
  const [loading, setLoading] = useState(!draft.metadata.reportCatalog?.length);
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
  const save = () => {
    onComplete({
      ...draft,
      metadata: { ...draft.metadata, reportCatalog: products },
    });
  };
  const actions = (position: "top" | "bottom") => (
    <WizardActions position={position}>
      <button type="button" className="secondary-button" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <RestartButton disabled={false} onRestart={onRestart} />
      <button
        type="button"
        className="primary-button compact"
        onClick={() => void save()}
        disabled={loading}
      >
        Continue <ChevronRight size={16} />
      </button>
    </WizardActions>
  );
  return (
    <div className="wizard-panel">
      {actions("top")}
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
      {actions("bottom")}
    </div>
  );
}

export function HistoricalImportPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId, programId } = useParams();
  const editing = Boolean(programId);
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<Partial<DraftState>>({});
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState("");
  const restart = () => {
    setDraft({});
    setStep(1);
    if (editing) navigate("/admin/projects/import", { replace: true });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const availableProjects = editing
          ? await api.projects()
          : await api.zohoProjects();
        if (!active) return;
        setProjects(availableProjects);
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
              programYear: program.year ?? undefined,
              projectAbbreviation: "",
              efsLaunchDate: datePart(
                details.StartDate ?? details.startsAt,
                "-",
              ),
              efsDeadline: datePart(details.EndDate ?? details.endsAt, "-"),
              reportCatalog,
              categoryPricing: Array.isArray(details.categoryPricing)
                ? (details.categoryPricing as CategoryPricing[])
                : defaultCategoryPricing.map((entry) => ({ ...entry })),
              organizationPrograms: organizations.map((organization) => ({
                organizationProgramId: organization.organizationProgramId,
                organizationName: organization.name,
                surveysSent: organization.surveysSent,
                isWinner: organization.isWinner,
                isIncluded: organization.isIncluded,
                ...(organization.stage ? { stage: organization.stage } : {}),
                ...(organization.companySize !== null
                  ? { companySize: organization.companySize }
                  : {}),
                ...(organization.currentZohoCategory
                  ? {
                      currentZohoCategory: organization.currentZohoCategory,
                    }
                  : {}),
                ...(organization.reportCategory
                  ? { reportCategory: organization.reportCategory }
                  : {}),
                ...(organization.benchmarkCategory
                  ? { benchmarkCategory: organization.benchmarkCategory }
                  : {}),
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

  let content: ReactNode;
  if (loadingInitial) {
    content = (
      <State
        loading
        title="Loading program wizard"
        message="Retrieving projects."
      />
    );
  } else if (initialError) {
    content = <State title="Wizard unavailable" message={initialError} />;
  } else if (step === 1) {
    content = (
      <MetadataStep
        draft={draft}
        projects={projects}
        editing={editing}
        onSaved={(next) => {
          setDraft(next);
          setStep(2);
        }}
      />
    );
  } else if (!draft.metadata) {
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
        onDraftChange={(next) => setDraft(next)}
        onComplete={(next) => {
          setDraft(next);
          setStep(3);
        }}
        onBack={() => setStep(1)}
        onRestart={restart}
      />
    );
  } else if (step === 3) {
    content = (
      <WinnersStep
        draft={draft as DraftState}
        onComplete={(next) => {
          setDraft(next);
          setStep(4);
        }}
        onBack={() => setStep(2)}
        onRestart={restart}
      />
    );
  } else if (step === 4) {
    content = (
      <CatalogStep
        draft={draft as DraftState}
        onComplete={(next) => {
          setDraft(next);
          setStep(5);
        }}
        onBack={() => setStep(3)}
        onRestart={restart}
      />
    );
  } else {
    content = (
      <ReviewStep
        draft={draft as DraftState}
        onBack={() => setStep(4)}
        onRestart={restart}
      />
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
            ? 5
            : draft.winnersConfigured
              ? 4
              : draft.uploadsConfigured
                ? 3
                : draft.metadata
                  ? 2
                  : 1
        }
        onStepChange={setStep}
      />
      {content}
    </>
  );
}
