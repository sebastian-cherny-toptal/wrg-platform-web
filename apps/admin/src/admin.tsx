import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileChartColumn,
  FileUp,
  KeyRound,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Search,
  ShoppingBag,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { SearchableSelect, WorkforceLogoWhite } from "@wrg/platform-ui";
import {
  api,
  categoryPricingFromApi,
  field,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  type CategoryPricing,
  type OrganizationRecord,
  type PendingKeyImpactAnalysis,
  type PortalUserRecord,
  type ProgramRecord,
  type ProgramZohoResyncChange,
  type ProgramZohoResyncField,
  type ProgramZohoResyncPreview,
  type ProgramZohoResyncValue,
  type ProjectRecord,
  type ReportProduct,
  type UserRecord,
} from "./api";
import { useAuth } from "./auth";
import { CatalogEditor, MoneyInput } from "./catalog-editor";
import { filterAndSortOrganizations } from "./organization-options";
import { LongRunningActionOverlay } from "./long-running-action-overlay";

const permissionLabels: Record<string, string> = {
  clientsProjectsProgramsAccess: "Access Shared Projects, Programs & Clients",
  syncCheckmartketAndZohoAccess: "Manually Re-Sync Checkmarket & Zoho Data",
  previewClientsDashboardAccess: "Preview Clients' Dashboards",
  exportReportsAccess: "Export Reports",
  uploadDownloadCustomReportAccess: "Upload & Download Custom Reports",
  uploadKeyImpactAnalysisAccess: "Upload Key Impact Analysis",
  orderLogAccess: "Access Order Logs",
};

type AdminViewCountKey =
  "projects" | "users" | "keyImpactAnalyses" | "orders" | "activity" | "roles";

const navigation: Array<{
  to: string;
  label: string;
  icon: typeof Activity;
  countKey?: AdminViewCountKey;
}> = [
  {
    to: "/admin/projects",
    label: "Imported Projects & Programs",
    icon: BriefcaseBusiness,
    countKey: "projects",
  },
  {
    to: "/admin/projects/import",
    label: "Import Historical Project",
    icon: FileUp,
  },
  {
    to: "/admin/users",
    label: "Users Management",
    icon: Users,
    countKey: "users",
  },
  {
    to: "/admin/key-impact-analysis",
    label: "KIA Uploads",
    icon: FileChartColumn,
    countKey: "keyImpactAnalyses",
  },
  {
    to: "/admin/order-log",
    label: "Order Log",
    icon: ClipboardList,
    countKey: "orders",
  },
  {
    to: "/admin/system-log",
    label: "Activity Log",
    icon: Activity,
    countKey: "activity",
  },
  {
    to: "/admin/role-permissions",
    label: "Roles",
    icon: ShieldCheck,
    countKey: "roles",
  },
];

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);
}

function useLoad<T>(key: string, loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setError("");
    return loader()
      .then(setData)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load data",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void reload();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload };
}

export function State({
  title,
  message,
  loading = false,
}: {
  title: string;
  message: string;
  loading?: boolean;
}) {
  return (
    <div className="state-card">
      {loading ? <span className="state-spinner" /> : null}
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="breadcrumbs">{breadcrumb ?? title}</div>
      <div className="page-heading">
        <h1>{title}</h1>
        {actions}
      </div>
    </>
  );
}

function Toolbar({
  search,
  setSearch,
  placeholder,
  date,
  setDate,
  extra,
  sort,
  setSort,
  sortOptions,
}: {
  search: string;
  setSearch: (value: string) => void;
  placeholder: string;
  date?: string;
  setDate?: (value: string) => void;
  extra?: ReactNode;
  sort?: string;
  setSort?: (value: string) => void;
  sortOptions?: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        {setSort && sortOptions ? (
          <SearchableSelect
            ariaLabel="Sort records"
            className="toolbar-select"
            onChange={setSort}
            options={sortOptions}
            searchPlaceholder="Search sort options…"
            value={sort ?? ""}
          />
        ) : null}
        {setDate ? (
          <label className="date-control">
            <CalendarDays size={16} />
            <input
              aria-label="Date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        ) : null}
        {extra}
      </div>
      <label className="search-control">
        <Search size={18} />
        <input
          type="search"
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  rowClassNames,
  empty = "No data found",
}: {
  headers: string[];
  rows: ReactNode[][];
  rowClassNames?: Array<string | undefined>;
  empty?: string;
}) {
  return (
    <div className="table-card">
      <table aria-label="simple table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr className={rowClassNames?.[rowIndex]} key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="empty-cell" colSpan={headers.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pager({
  count,
  shown,
  page = 1,
  pageSize = shown,
  onPageChange,
}: {
  count: number;
  shown: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const controlled = Boolean(onPageChange);
  const start = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  return (
    <div className="pager">
      <span>
        {controlled
          ? `${start} - ${end} of ${count}`
          : `${Math.min(shown, count)} out of ${count}`}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={!controlled || page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          ‹
        </button>
        <button className="current" aria-label={`Page ${page}`}>
          {page}
        </button>
        <button
          aria-label="Next page"
          disabled={!controlled ? count <= shown : page >= pageCount}
          onClick={() => onPageChange?.(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function AdminShell() {
  const { auth, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const viewCounts = useLoad(
    `admin-view-counts:${location.pathname}`,
    api.adminViewCounts,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const initial = auth?.user.displayName.slice(0, 1).toUpperCase() || "A";
  return (
    <div className="admin-app">
      <header className="mobile-header">
        <WorkforceLogoWhite />
        <button
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <Link
          className="sidebar-logo"
          to="/admin/projects"
          onClick={() => setMenuOpen(false)}
        >
          <WorkforceLogoWhite />
        </Link>
        <nav>
          {navigation.map(({ to, label, icon: Icon, countKey }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>
                {label}
                {countKey && viewCounts.data
                  ? ` (${viewCounts.data[countKey]})`
                  : ""}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="admin-column">
        <header className="topbar">
          <div className="profile-wrap">
            <button
              className="avatar"
              onClick={() => setProfileOpen((open) => !open)}
            >
              {initial}
            </button>
            {profileOpen ? (
              <div className="profile-menu">
                <div>
                  <strong>{auth?.user.displayName}</strong>
                  <span>{auth?.user.email}</span>
                </div>
                <button
                  onClick={() => {
                    void logout().then(() => navigate("/admin-login"));
                  }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
        <footer>
          <span>Workforce Research Group {new Date().getFullYear()} ©</span>
          <span>|</span>
          <a
            href="https://workforcerg.com/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            WRG Privacy Policy
          </a>
          <span className="footer-contact">
            (281) 602-5004 | answers@workforcerg.com
          </span>
        </footer>
      </section>
    </div>
  );
}

export function ProjectsPage() {
  const { auth } = useAuth();
  const loaded = useLoad("projects", api.projects);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [deleting, setDeleting] = useState("");
  const deletingRef = useRef("");
  const [notice, setNotice] = useState("");
  const canDelete = Boolean(
    auth?.user.roles.some(
      (role) => role === "admin" || role === "super_admin",
    ) || auth?.user.permissions.includes("ops.manage"),
  );
  const deleteProject = async (project: ProjectRecord) => {
    if (deletingRef.current) return;
    if (
      !window.confirm(
        `Delete ${project.name}? This permanently deletes the project and all ${project.programs.length} associated program${project.programs.length === 1 ? "" : "s"}, including their organization enrollments and survey data. This cannot be undone.`,
      )
    ) {
      return;
    }
    deletingRef.current = project.id;
    setDeleting(project.id);
    setNotice("");
    try {
      await api.deleteProject(project.id);
      loaded.reload();
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "Project could not be deleted.",
      );
    } finally {
      deletingRef.current = "";
      setDeleting("");
    }
  };
  const rows = useMemo(() => {
    const filtered = (loaded.data ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) &&
        (!date || item.createdAt?.slice(0, 10) === date),
    );
    return [...filtered].sort((left, right) => {
      if (sort === "name:asc") return left.name.localeCompare(right.name);
      if (sort === "programs:desc")
        return right.programs.length - left.programs.length;
      return (
        new Date(right.createdAt ?? 0).getTime() -
        new Date(left.createdAt ?? 0).getTime()
      );
    });
  }, [loaded.data, search, date, sort]);
  return (
    <>
      {deleting ? <LongRunningActionOverlay title="Deleting project…" /> : null}
      <PageHeader
        title="Imported Projects"
        breadcrumb="Imported Projects & Programs"
        actions={
          <Link className="primary-button compact" to="/admin/projects/import">
            Import Historical Project
          </Link>
        }
      />
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search Projects"
        date={date}
        setDate={setDate}
        sort={sort}
        setSort={setSort}
        sortOptions={[
          { value: "createdAt:desc", label: "Newest first" },
          { value: "name:asc", label: "Name A–Z" },
          { value: "programs:desc", label: "Most programs" },
        ]}
      />
      {loaded.loading ? (
        <State
          loading
          title="Loading projects"
          message="Retrieving administration data."
        />
      ) : loaded.error ? (
        <State title="Projects unavailable" message={loaded.error} />
      ) : (
        <>
          <DataTable
            headers={[
              "Project Name",
              "Date of Creation",
              "# Programs",
              "Programs",
              "Actions",
            ]}
            rows={rows.slice(0, 10).map((item) => [
              <strong>{item.name}</strong>,
              formatDate(item.createdAt),
              item.programs.length,
              item.programs.map((entry) => entry.name).join(", ") || "—",
              <div className="row-actions">
                <Link className="action-link" to={`/admin/projects/${item.id}`}>
                  View <ChevronRight size={18} />
                </Link>
                {canDelete ? (
                  <button
                    className="icon-button danger-text"
                    title="Delete"
                    aria-label={`Delete ${item.name}`}
                    disabled={deleting === item.id}
                    onClick={() => void deleteProject(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>,
            ])}
          />
          {notice ? <div className="notice">{notice}</div> : null}
          <Pager count={rows.length} shown={10} />
        </>
      )}
    </>
  );
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const { auth } = useAuth();
  const loaded = useLoad(`project:${projectId}`, () => api.project(projectId));
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState("");
  const deletingRef = useRef("");
  const [notice, setNotice] = useState("");
  const canDelete = Boolean(
    auth?.user.roles.some(
      (role) => role === "admin" || role === "super_admin",
    ) || auth?.user.permissions.includes("ops.manage"),
  );
  if (loaded.loading)
    return (
      <State loading title="Loading project" message="Retrieving programs." />
    );
  if (loaded.error || !loaded.data)
    return (
      <State
        title="Project unavailable"
        message={loaded.error || "Project not found"}
      />
    );
  const project = loaded.data;
  const programs = project.programs.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (!date || item.createdAt?.slice(0, 10) === date),
  );
  const deleteProgram = async (program: ProgramRecord) => {
    if (deletingRef.current) return;
    if (
      !window.confirm(
        `Delete ${program.name}? This permanently deletes the program, all ${program.organizationCount} associated organization enrollment${program.organizationCount === 1 ? "" : "s"}, and its survey data. This cannot be undone.`,
      )
    ) {
      return;
    }
    deletingRef.current = program.id;
    setDeleting(program.id);
    setNotice("");
    try {
      await api.deleteProgram(program.id);
      loaded.reload();
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "Program could not be deleted.",
      );
    } finally {
      deletingRef.current = "";
      setDeleting("");
    }
  };
  return (
    <>
      {deleting ? <LongRunningActionOverlay title="Deleting program…" /> : null}
      <PageHeader
        title={project.name}
        breadcrumb={
          <>
            <Link to="/admin/projects">Projects</Link>
            <span>|</span>
            {project.name}
          </>
        }
      />
      <button
        className={expanded ? "details-toggle expanded" : "details-toggle"}
        onClick={() => setExpanded((value) => !value)}
      >
        <strong>Project Details</strong>
        <ChevronDown size={18} />
      </button>
      {expanded ? (
        <div className="details-panel">
          <Detail label="Project ID" value={project.id} />
          <Detail label="Date Created" value={formatDate(project.createdAt)} />
          <Detail label="Programs" value={String(project.programs.length)} />
        </div>
      ) : null}
      <h2 className="section-title">Programs</h2>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search Programs"
        date={date}
        setDate={setDate}
      />
      <DataTable
        headers={[
          "Program Name",
          "Date of Creation",
          "Number of Organizations",
          "Actions",
        ]}
        rows={programs.map((item) => [
          <strong>{item.name}</strong>,
          formatDate(item.createdAt),
          item.organizationCount,
          <div className="row-actions">
            <Link
              className="action-link"
              to={`/admin/projects/${project.id}/programs/${item.id}`}
            >
              View <ChevronRight size={18} />
            </Link>
            {canDelete ? (
              <button
                className="icon-button danger-text"
                title="Delete"
                aria-label={`Delete ${item.name}`}
                disabled={deleting === item.id}
                onClick={() => void deleteProgram(item)}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>,
        ])}
      />
      {notice ? <div className="notice">{notice}</div> : null}
      <Pager count={programs.length} shown={10} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function resyncDisplayValue(value: ProgramZohoResyncValue): string {
  return value === null || value === "" ? "Not provided" : String(value);
}

export function ZohoResyncValue({
  value,
  change,
}: {
  value: ProgramZohoResyncValue;
  change?: ProgramZohoResyncChange;
}) {
  if (!change) return <>{resyncDisplayValue(value)}</>;
  return (
    <span className="zoho-resync-value">
      <del>{resyncDisplayValue(change.previous)}</del>
      <span>{resyncDisplayValue(change.next)}</span>
    </span>
  );
}

type CategorySummary = {
  category: string;
  winners: number;
  nonWinners: number;
  total: number;
};

function previewCategorySummaries(
  summaries: CategorySummary[],
  organizations: OrganizationRecord[],
  preview: ProgramZohoResyncPreview | null,
): Map<string, CategorySummary> {
  const next = new Map(
    summaries.map((summary) => [
      summary.category.toLocaleLowerCase("en"),
      { ...summary },
    ]),
  );
  const organizationsByEnrollment = new Map(
    organizations.map((organization) => [
      organization.organizationProgramId,
      organization,
    ]),
  );
  for (const row of preview?.changedRows ?? []) {
    const organization = organizationsByEnrollment.get(
      row.organizationProgramId,
    );
    if (!organization?.isIncluded) continue;
    const changes = new Map(
      row.changes.map((change) => [change.field, change.next]),
    );
    const previousCategory =
      organization.currentZohoCategory?.toLocaleLowerCase("en") ?? "";
    const nextCategoryValue = changes.has("currentZohoCategory")
      ? changes.get("currentZohoCategory")
      : organization.currentZohoCategory;
    const nextCategory =
      typeof nextCategoryValue === "string"
        ? nextCategoryValue.toLocaleLowerCase("en")
        : "";
    const nextWinnerValue = changes.has("isWinner")
      ? changes.get("isWinner")
      : organization.isWinner;
    const nextWinner =
      nextWinnerValue === "Y" || nextWinnerValue === "N"
        ? nextWinnerValue
        : null;
    if (
      previousCategory === nextCategory &&
      organization.isWinner === nextWinner
    ) {
      continue;
    }
    const previousSummary = next.get(previousCategory);
    if (previousSummary) {
      previousSummary.total -= 1;
      if (organization.isWinner === "Y") previousSummary.winners -= 1;
      if (organization.isWinner === "N") previousSummary.nonWinners -= 1;
    }
    const nextSummary = next.get(nextCategory);
    if (nextSummary) {
      nextSummary.total += 1;
      if (nextWinner === "Y") nextSummary.winners += 1;
      if (nextWinner === "N") nextSummary.nonWinners += 1;
    }
  }
  return next;
}

function SummaryPreviewValue({
  previous,
  next,
}: {
  previous: number;
  next: number;
}) {
  if (previous === next) return <strong>{previous}</strong>;
  return (
    <strong className="zoho-resync-summary-change">
      <del>{previous}</del>
      <span>{next}</span>
    </strong>
  );
}

function programCategoryPricing(
  program: ProgramRecord | null,
): CategoryPricing[] {
  const configured = program?.details?.categoryPricing;
  return Array.isArray(configured) ? categoryPricingFromApi(configured) : [];
}

async function loadProgramCatalog(programId: string): Promise<ReportProduct[]> {
  const [templates, configured] = await Promise.all([
    api.reportProductTemplates(),
    api.programCatalog(programId),
  ]);
  return templates.map(
    (template) =>
      configured.find(({ id }) => id === template.id) ?? { ...template },
  );
}

export function ProgramDetailPage() {
  const { projectId = "", programId = "" } = useParams();
  const { auth } = useAuth();
  const programLoaded = useLoad(`program:${programId}`, () =>
    api.program(programId),
  );
  const organizationsLoaded = useLoad(`organizations:${programId}`, () =>
    api.organizations(programId),
  );
  const catalogLoaded = useLoad(`program-catalog:${programId}`, () =>
    loadProgramCatalog(programId),
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("id:asc");
  const [page, setPage] = useState(1);
  const [activeProgramSection, setActiveProgramSection] = useState<
    "details" | "pricing" | "store"
  >("details");
  const [categoryPricing, setCategoryPricing] = useState<CategoryPricing[]>([]);
  const [products, setProducts] = useState<ReportProduct[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [storeError, setStoreError] = useState("");
  const [savingCategories, setSavingCategories] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [resyncPreview, setResyncPreview] =
    useState<ProgramZohoResyncPreview | null>(null);
  const [resyncApplied, setResyncApplied] = useState(false);
  const [resyncing, setResyncing] = useState<"preview" | "apply" | null>(null);
  const [downloadingConnections, setDownloadingConnections] = useState(false);
  const [previewOrganization, setPreviewOrganization] =
    useState<OrganizationRecord | null>(null);
  const [catalogOrganization, setCatalogOrganization] =
    useState<OrganizationRecord | null>(null);
  const program = programLoaded.data;
  useEffect(() => {
    setCategoryPricing(programCategoryPricing(program));
  }, [program]);
  useEffect(() => {
    if (catalogLoaded.data) setProducts(catalogLoaded.data);
  }, [catalogLoaded.data]);
  const canUploadBenefits =
    auth?.user.roles.some(
      (role) => role === "admin" || role === "super_admin",
    ) || auth?.user.permissions.includes("ops.manage");
  const changedOrganizationIds = new Set(
    (resyncPreview?.changedRows ?? []).map((row) => row.organizationProgramId),
  );
  const normalizedSearch = search.toLowerCase();
  const organizations = [...(organizationsLoaded.data ?? [])]
    .filter(
      (item) =>
        (item.name.toLowerCase().includes(normalizedSearch) ||
          item.sourceId.toLowerCase().includes(normalizedSearch) ||
          item.sourceName?.toLowerCase().includes(normalizedSearch)) &&
        (!date || item.createdAt?.slice(0, 10) === date),
    )
    .sort((left, right) => {
      if (sort === "changes:first") {
        const changeOrder =
          Number(changedOrganizationIds.has(right.organizationProgramId)) -
          Number(changedOrganizationIds.has(left.organizationProgramId));
        if (changeOrder) return changeOrder;
      }
      if (sort === "name:asc") return left.name.localeCompare(right.name);
      if (sort === "surveys:desc") return right.surveysSent - left.surveysSent;
      if (sort === "winners:first" || sort === "winners:last") {
        const winnerRank = (value: OrganizationRecord["isWinner"]) =>
          value === "Y" ? 2 : value === "N" ? 1 : 0;
        const winnerOrder =
          winnerRank(right.isWinner) - winnerRank(left.isWinner);
        const primary = sort === "winners:first" ? winnerOrder : -winnerOrder;
        return primary || left.name.localeCompare(right.name);
      }
      return left.sourceId.localeCompare(right.sourceId, undefined, {
        numeric: true,
      });
    });
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(organizations.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedOrganizations = organizations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  useEffect(() => setPage(1), [search, date, sort]);
  if (programLoaded.loading)
    return (
      <State
        loading
        title="Loading program"
        message="Retrieving program details."
      />
    );
  if (!program || programLoaded.error)
    return (
      <State
        title="Program unavailable"
        message={programLoaded.error || "Program not found"}
      />
    );
  const details = program.details ?? {};
  const previewSummaries = previewCategorySummaries(
    program.categorySummaries,
    organizationsLoaded.data ?? [],
    resyncApplied ? null : resyncPreview,
  );
  const resync = async () => {
    setResyncPreview(null);
    setResyncApplied(false);
    setResyncing("preview");
    setSyncNotice("Checking Zoho for changes…");
    try {
      const preview = await api.previewProgramZohoResync(program.id);
      setResyncPreview(preview);
      setSort("changes:first");
      const warnings = [
        preview.unmatchedZoho.length
          ? `${preview.unmatchedZoho.length} Zoho deal${preview.unmatchedZoho.length === 1 ? "" : "s"} did not match an existing organization`
          : "",
        preview.missingLocal.length
          ? `${preview.missingLocal.length} local organization${preview.missingLocal.length === 1 ? " is" : "s are"} missing from Zoho`
          : "",
      ].filter(Boolean);
      setSyncNotice(
        preview.changedRows.length
          ? `${preview.changedRows.length} organization${preview.changedRows.length === 1 ? " has" : "s have"} changes to review.${warnings.length ? ` ${warnings.join("; ")}.` : ""}`
          : `Zoho is already in sync.${warnings.length ? ` ${warnings.join("; ")}.` : ""}`,
      );
    } catch (caught) {
      setSyncNotice(
        caught instanceof Error
          ? caught.message
          : "Zoho changes could not be loaded.",
      );
    } finally {
      setResyncing(null);
    }
  };
  const applyResync = async () => {
    if (!resyncPreview?.changedRows.length) return;
    if (
      !window.confirm(
        `Apply Zoho changes to ${resyncPreview.changedRows.length} organization${resyncPreview.changedRows.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    setResyncing("apply");
    setSyncNotice("Applying Zoho changes…");
    try {
      const result = await api.applyProgramZohoResync(
        program.id,
        resyncPreview.revision,
      );
      setResyncPreview(result);
      setResyncApplied(true);
      setSyncNotice(
        `Applied Zoho changes to ${result.appliedCount} organization${result.appliedCount === 1 ? "" : "s"}.`,
      );
      await Promise.all([organizationsLoaded.reload(), programLoaded.reload()]);
    } catch (caught) {
      setSyncNotice(
        caught instanceof Error
          ? caught.message
          : "Zoho changes could not be applied.",
      );
    } finally {
      setResyncing(null);
    }
  };
  const changesByOrganization = new Map(
    (resyncPreview?.changedRows ?? []).map((row) => [
      row.organizationProgramId,
      new Map(row.changes.map((change) => [change.field, change])),
    ]),
  );
  const downloadConnections = async () => {
    setDownloadingConnections(true);
    try {
      await api.downloadOrganizationsConnectionFields(program.id);
    } catch (caught) {
      setSyncNotice(
        caught instanceof Error
          ? caught.message
          : "The organizations connection fields could not be downloaded.",
      );
    } finally {
      setDownloadingConnections(false);
    }
  };
  const saveCategoryPrices = async (event: FormEvent) => {
    event.preventDefault();
    setCategoryError("");
    if (
      !categoryPricing.length ||
      categoryPricing.some(
        ({ priceCents }) =>
          priceCents === null ||
          !Number.isInteger(priceCents) ||
          priceCents < 0,
      )
    ) {
      setCategoryError("Enter a price for every category.");
      return;
    }
    setSavingCategories(true);
    try {
      const saved = await api.saveProgramCategoryPrices(
        program.id,
        categoryPricing,
      );
      setCategoryPricing(saved);
      setNotice("Category prices were saved.");
      await programLoaded.reload();
    } catch (caught) {
      setCategoryError(
        caught instanceof Error
          ? caught.message
          : "Category prices could not be saved.",
      );
    } finally {
      setSavingCategories(false);
    }
  };
  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    setStoreError("");
    setSavingStore(true);
    try {
      const saved = await api.saveProgramCatalog(program.id, products);
      setProducts(saved);
      setNotice("The program store was saved.");
    } catch (caught) {
      setStoreError(
        caught instanceof Error
          ? caught.message
          : "The store could not be saved.",
      );
    } finally {
      setSavingStore(false);
    }
  };
  return (
    <>
      <PageHeader
        title={program.name}
        breadcrumb={
          <>
            <Link to={`/admin/projects/${projectId}`}>Project</Link>
            <span>|</span>
            {program.name}
          </>
        }
      />
      <div aria-label="Program sections" className="program-tabs" role="tablist">
        {([
          ["details", "Program Details"],
          ["pricing", "Report pricing"],
          ["store", "Store"],
        ] as const).map(([section, label]) => (
          <button
            aria-controls={`program-${section}-panel`}
            aria-selected={activeProgramSection === section}
            className="program-tab"
            id={`program-${section}-tab`}
            key={section}
            onClick={() => setActiveProgramSection(section)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {activeProgramSection === "details" ? (
        <div
          aria-labelledby="program-details-tab"
          className="details-panel details-grid program-tab-panel"
          id="program-details-panel"
          role="tabpanel"
        >
          <Detail label="Program ID" value={program.id} />
          <Detail
            label="Program Year"
            value={program.year ? String(program.year) : "—"}
          />
          <Detail
            label="EFS Launch Date"
            value={formatCalendarDate(details.StartDate ?? details.startsAt)}
          />
          <Detail
            label="EFS Deadline"
            value={formatCalendarDate(details.EndDate ?? details.endsAt)}
          />
          <section
            className="organization-summary details-category-summary"
            aria-label="Organizations by category"
          >
            {program.categorySummaries.map(
              ({ category, winners, nonWinners, total }) => {
                const next = previewSummaries.get(
                  category.toLocaleLowerCase("en"),
                );
                return (
                  <div key={category}>
                    <span className="organization-summary-label">
                      {category}
                    </span>
                    <div className="organization-summary-counts">
                      <span>
                        <SummaryPreviewValue
                          previous={winners}
                          next={next?.winners ?? winners}
                        />
                        <small>Winners</small>
                      </span>
                      <span>
                        <SummaryPreviewValue
                          previous={nonWinners}
                          next={next?.nonWinners ?? nonWinners}
                        />
                        <small>Non-Winners</small>
                      </span>
                      <span>
                        <SummaryPreviewValue
                          previous={total}
                          next={next?.total ?? total}
                        />
                        <small>Total</small>
                      </span>
                    </div>
                  </div>
                );
              },
            )}
          </section>
        </div>
      ) : null}
      {activeProgramSection === "pricing" ? (
        <form
          aria-labelledby="program-pricing-tab"
          className="details-panel program-configuration-panel program-tab-panel"
          id="program-pricing-panel"
          noValidate
          onSubmit={(event) => void saveCategoryPrices(event)}
          role="tabpanel"
        >
          <div className="category-pricing-grid">
            {categoryPricing.length ? (
              categoryPricing.map((entry) => (
                <div className="category-pricing-row" key={entry.tier}>
                  <div className="category-name-control">
                    <span>Pricing category</span>
                    <strong>{entry.pricingCategoryName}</strong>
                  </div>
                  <label>
                    Report price (USD)
                    <MoneyInput
                      ariaLabel={`${entry.pricingCategoryName} report price`}
                      onChange={(priceCents) =>
                        setCategoryPricing((current) =>
                          current.map((category) =>
                            category.tier === entry.tier
                              ? { ...category, priceCents }
                              : category,
                          ),
                        )
                      }
                      priceCents={entry.priceCents}
                      required
                    />
                  </label>
                </div>
              ))
            ) : (
              <p className="form-error">
                This program has no configured categories.
              </p>
            )}
          </div>
          {categoryError ? <p className="form-error">{categoryError}</p> : null}
          <div className="program-configuration-actions">
            <button
              className="primary-button"
              disabled={savingCategories || !categoryPricing.length}
              type="submit"
            >
              {savingCategories ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
      {activeProgramSection === "store" ? (
        <form
          aria-labelledby="program-store-tab"
          className="details-panel program-configuration-panel program-tab-panel"
          id="program-store-panel"
          onSubmit={(event) => void saveStore(event)}
          role="tabpanel"
        >
          {catalogLoaded.loading ? (
            <p>Loading product options…</p>
          ) : catalogLoaded.error ? (
            <p className="form-error">{catalogLoaded.error}</p>
          ) : (
            <CatalogEditor products={products} onChange={setProducts} />
          )}
          {storeError ? <p className="form-error">{storeError}</p> : null}
          <div className="program-configuration-actions">
            <button
              className="primary-button"
              disabled={
                savingStore ||
                catalogLoaded.loading ||
                Boolean(catalogLoaded.error)
              }
              type="submit"
            >
              {savingStore ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
      {notice ? <div className="notice">{notice}</div> : null}
      <h2 className="section-title">Organization</h2>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search organization IDs or names"
        date={date}
        setDate={setDate}
        sort={sort}
        setSort={setSort}
        sortOptions={[
          { value: "id:asc", label: "Organization ID" },
          { value: "changes:first", label: "Rows being edited first" },
          { value: "name:asc", label: "Organization name" },
          { value: "surveys:desc", label: "Most surveys sent" },
          { value: "winners:first", label: "Winners first" },
          { value: "winners:last", label: "Winners last" },
        ]}
      />
      <section
        aria-labelledby="program-sync-title"
        className="program-sync-panel"
      >
        <div className="program-sync-heading">
          <div>
            <h3 id="program-sync-title">Zoho deal synchronization</h3>
            <p>
              Review the latest Zoho data before applying changes to local
              organizations.
            </p>
          </div>
          <span className="latest-zoho-sync">
            Latest Zoho sync: {formatDateTime(program.latestZohoSync)}
          </span>
        </div>
        <div className="program-sync-actions">
          <button
            className="secondary-button compact action-link"
            disabled={downloadingConnections}
            onClick={() => void downloadConnections()}
          >
            <Download size={16} />
            {downloadingConnections
              ? "Downloading…"
              : "Download organizations connection fields"}
          </button>
          <button
            className="primary-button compact"
            disabled={resyncing !== null || resyncPreview !== null}
            onClick={() => void resync()}
          >
            {resyncing === "preview" ? "Checking Zoho…" : "Re-Sync All Deals"}
          </button>
          {resyncPreview ? (
            <button
              className="secondary-button compact"
              disabled={resyncing !== null}
              onClick={() => {
                setResyncPreview(null);
                setResyncApplied(false);
                setSyncNotice("");
              }}
            >
              Discard preview
            </button>
          ) : null}
          {resyncPreview?.changedRows.length && !resyncApplied ? (
            <button
              className="primary-button compact"
              disabled={resyncing !== null}
              onClick={() => void applyResync()}
            >
              {resyncing === "apply" ? "Applying…" : "Apply all Zoho changes"}
            </button>
          ) : null}
        </div>
        {syncNotice ? (
          <div className="program-sync-status" role="status">
            {syncNotice}
          </div>
        ) : null}
        {resyncPreview?.unmatchedZoho.length ||
        resyncPreview?.missingLocal.length ? (
          <div className="program-sync-exceptions">
            {resyncPreview.unmatchedZoho.length ? (
              <section className="program-sync-exception-list">
                <div>
                  <h3>Zoho deals without a local match</h3>
                  <span>{resyncPreview.unmatchedZoho.length}</span>
                </div>
                <ul>
                  {resyncPreview.unmatchedZoho.map((deal) => (
                    <li key={deal.organizationId}>
                      <strong>{deal.organizationName || "Unnamed deal"}</strong>
                      <span>Zoho organization ID: {deal.organizationId}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {resyncPreview.missingLocal.length ? (
              <section className="program-sync-exception-list">
                <div>
                  <h4>Local organizations missing from Zoho</h4>
                  <span>{resyncPreview.missingLocal.length}</span>
                </div>
                <p>These local organizations were not found in Zoho.</p>
                <ul>
                  {resyncPreview.missingLocal.map((organization) => (
                    <li key={organization.organizationProgramId}>
                      <strong>{organization.organizationName}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
      <DataTable
        headers={[
          "Organization ID",
          "Organization Name",
          "Date Added",
          "Current Stage",
          "Last Time Synced",
          "No. of Surveys Sent",
          "Employees",
          "Overall Rank",
          "Category Rank",
          "Winner",
          "Report Category",
          "Benchmark Category",
          "Actions",
        ]}
        rowClassNames={pagedOrganizations.map((item) =>
          changesByOrganization.has(item.organizationProgramId)
            ? "zoho-resync-changed-row"
            : undefined,
        )}
        rows={pagedOrganizations.map((item) => {
          const changes = changesByOrganization.get(item.organizationProgramId);
          const change = (field: ProgramZohoResyncField) => changes?.get(field);
          return [
            <strong>{item.sourceId}</strong>,
            <ZohoResyncValue
              value={item.name}
              change={change("organizationName")}
            />,
            formatDate(item.createdAt),
            <ZohoResyncValue value={item.stage} change={change("stage")} />,
            formatDate(item.lastSyncedAt),
            <ZohoResyncValue
              value={item.surveysSent}
              change={change("surveysSent")}
            />,
            <div className="zoho-resync-stacked-value">
              <ZohoResyncValue
                value={item.employeesCount}
                change={change("employeesCount")}
              />
              <small>
                Company size: <ZohoResyncValue value={item.companySize} />
              </small>
            </div>,
            <ZohoResyncValue
              value={item.overallRank}
              change={change("overallRank")}
            />,
            <ZohoResyncValue
              value={item.categoryRank}
              change={change("categoryRank")}
            />,
            item.isIncluded ? (
              <ZohoResyncValue
                value={item.isWinner}
                change={change("isWinner")}
              />
            ) : (
              "Not included"
            ),
            <ZohoResyncValue
              value={item.reportCategory}
              change={change("reportCategory")}
            />,
            <ZohoResyncValue
              value={item.currentZohoCategory}
              change={change("currentZohoCategory")}
            />,
            <div className="row-actions">
              <button
                className="action-link button-link"
                onClick={() => setPreviewOrganization(item)}
              >
                View Dashboard <ChevronRight size={18} />
              </button>
              {canUploadBenefits ? (
                <button
                  className="action-link button-link"
                  onClick={() => setCatalogOrganization(item)}
                >
                  Configure store <ShoppingBag size={17} />
                </button>
              ) : null}
            </div>,
          ];
        })}
      />
      <Pager
        count={organizations.length}
        shown={pageSize}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {previewOrganization ? (
        <ImpersonationUserModal
          organization={previewOrganization}
          program={program}
          onClose={() => setPreviewOrganization(null)}
        />
      ) : null}
      {catalogOrganization ? (
        <CatalogModal
          scope={{
            kind: "organization",
            id: catalogOrganization.organizationProgramId,
            label: `${catalogOrganization.name} — ${program.name}`,
          }}
          onClose={() => setCatalogOrganization(null)}
          onSaved={() =>
            setNotice(
              `The report store was updated for ${catalogOrganization.name}.`,
            )
          }
        />
      ) : null}
    </>
  );
}

function CatalogModal({
  scope,
  onClose,
  onSaved,
}: {
  scope: { kind: "program" | "organization"; id: string; label: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<import("./api").ReportProduct[]>([]);
  const [inherit, setInherit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api.reportProductTemplates(),
      scope.kind === "program"
        ? api.programCatalog(scope.id)
        : api.organizationCatalog(scope.id),
    ])
      .then(([templates, configured]) => {
        if (!active) return;
        const selected = Array.isArray(configured)
          ? configured
          : configured.products;
        setProducts(
          templates.map(
            (template) =>
              selected.find(({ id }) => id === template.id) ?? {
                ...template,
                available: false,
              },
          ),
        );
        if (!Array.isArray(configured)) setInherit(configured.inherited);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load catalog",
        ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [scope.id, scope.kind]);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (scope.kind === "program")
        await api.saveProgramCatalog(scope.id, products);
      else await api.saveOrganizationCatalog(scope.id, products, inherit);
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save catalog",
      );
      setSaving(false);
    }
  };
  return (
    <Modal title={`Configure report store — ${scope.label}`} onClose={onClose}>
      {scope.kind === "organization" ? (
        <label className="inherit-catalog">
          <input
            type="checkbox"
            checked={inherit}
            onChange={(event) => setInherit(event.target.checked)}
          />
          <span>
            <strong>Use program catalog</strong>
            <small>
              Keep this organization synchronized with program-wide products and
              prices.
            </small>
          </span>
        </label>
      ) : null}
      {loading ? (
        <p className="modal-copy">Loading catalog…</p>
      ) : inherit ? (
        <p className="notice">
          This organization currently uses the program catalog. Turn off the
          option above to customize it.
        </p>
      ) : (
        <CatalogEditor products={products} onChange={setProducts} />
      )}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          className="secondary-button"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="primary-button"
          onClick={() => void save()}
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "Save catalog"}
        </button>
      </div>
    </Modal>
  );
}

export function KeyImpactAnalysisUploadsPage() {
  const pending = useLoad("pending-kia-uploads", api.pendingKeyImpactAnalyses);
  const [selected, setSelected] = useState<PendingKeyImpactAnalysis | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  if (pending.loading && !pending.data) {
    return (
      <State
        loading
        title="Loading KIA purchases"
        message="Finding reports that still need an upload."
      />
    );
  }
  if (pending.error) {
    return <State title="KIA purchases unavailable" message={pending.error} />;
  }
  const items = pending.data ?? [];
  return (
    <>
      <PageHeader
        title="Key Impact Analysis uploads"
        breadcrumb="Programs | Key Impact Analysis uploads"
      />
      <p className="page-intro">
        Programs shown here have purchased Key Impact Analysis but do not yet
        have a report uploaded.
      </p>
      {notice ? <div className="notice">{notice}</div> : null}
      {items.length ? (
        <DataTable
          headers={[
            "Organization",
            "Program",
            "Project",
            "Purchased",
            "Status",
            "Actions",
          ]}
          rows={items.map((item) => [
            item.organizationName,
            `${item.programName}${item.programYear ? ` (${item.programYear})` : ""}`,
            item.projectName,
            formatDate(item.purchasedAt),
            item.status,
            <button
              className="primary-button compact"
              onClick={() => setSelected(item)}
            >
              Upload KIA <FileUp size={16} />
            </button>,
          ])}
        />
      ) : (
        <State
          title="All KIA reports are uploaded"
          message="There are no purchased Key Impact Analysis reports waiting for a file."
        />
      )}
      {selected ? (
        <KeyImpactAnalysisUploadModal
          item={selected}
          onClose={() => setSelected(null)}
          onUploaded={(fileName) => {
            setNotice(
              `${fileName} was uploaded for ${selected.organizationName} — ${selected.programName}.`,
            );
            setSelected(null);
            void pending.reload();
          }}
        />
      ) : null}
    </>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function KeyImpactAnalysisUploadModal({
  item,
  onClose,
  onUploaded,
}: {
  item: PendingKeyImpactAnalysis;
  onClose: () => void;
  onUploaded: (fileName: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !/\.xlsx$/iu.test(file.name)) {
      setError("Choose an .xlsx Key Impact Analysis workbook.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("The selected workbook must be 25 MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await api.uploadKeyImpactAnalysis(item, file);
      onUploaded(file.name);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The workbook could not be uploaded.",
      );
      setUploading(false);
    }
  };
  return (
    <Modal title="Upload Key Impact Analysis" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <p className="modal-copy">
          Upload the KIA workbook for <strong>{item.organizationName}</strong>{" "}
          in <strong>{item.programName}</strong>.
        </p>
        <label className="upload-card benefits-upload-card">
          <FileUp size={34} aria-hidden="true" />
          <strong>
            {file ? "Workbook selected" : "Choose an XLSX workbook"}
          </strong>
          <span>{file?.name ?? "Maximum file size: 25 MB"}</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={uploading}
            onChange={(event) => {
              setError("");
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={uploading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload workbook"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImpersonationUserModal({
  organization,
  program,
  onClose,
}: {
  organization: OrganizationRecord;
  program: ProgramRecord;
  onClose: () => void;
}) {
  const users = useLoad(
    `impersonation-users:${organization.id}:${program.id}`,
    () => api.eligibleImpersonationUsers(organization.id, program.id),
  );
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const openDashboard = async () => {
    if (users.data?.length && !selectedUserId) return;
    setOpening(true);
    setError("");
    try {
      const result = await api.startImpersonation(
        organization.id,
        program.id,
        selectedUserId,
      );
      window.location.assign(result.url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to open dashboard",
      );
      setOpening(false);
    }
  };
  return (
    <Modal
      title={users.data?.length ? "Choose a portal user" : "Preview dashboard"}
      onClose={onClose}
    >
      <p className="modal-description">
        {users.data?.length ? (
          <>
            Select the user whose access you want to use for{" "}
            <strong>{organization.name}</strong>.
          </>
        ) : (
          <>
            No portal user exists for <strong>{organization.name}</strong>. A
            generic, program-scoped preview identity will be used.
          </>
        )}
      </p>
      {users.loading ? (
        <State
          loading
          title="Loading users"
          message="Finding users with access to this program."
        />
      ) : users.error ? (
        <State title="Users unavailable" message={users.error} />
      ) : users.data?.length ? (
        <div
          className="impersonation-user-list"
          role="radiogroup"
          aria-label="Portal users with program access"
        >
          {users.data.map((user: PortalUserRecord) => (
            <label
              className={
                selectedUserId === user.id
                  ? "impersonation-user selected"
                  : "impersonation-user"
              }
              key={user.id}
            >
              <input
                type="radio"
                name="impersonation-user"
                value={user.id}
                checked={selectedUserId === user.id}
                onChange={() => setSelectedUserId(user.id)}
              />
              <span>
                <strong>{user.fullName}</strong>
                <small>
                  {user.email}
                  {user.username ? ` · ${user.username}` : ""}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          disabled={opening}
        >
          Cancel
        </button>
        <button
          type="button"
          className="primary-button compact"
          disabled={
            (Boolean(users.data?.length) && !selectedUserId) ||
            opening ||
            users.loading ||
            Boolean(users.error)
          }
          onClick={() => void openDashboard()}
        >
          {opening ? "Opening…" : "View Dashboard"}
        </button>
      </div>
    </Modal>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const roles = useLoad("modal-roles", api.roles);
  const projects = useLoad("modal-projects", api.projects);
  const organizations = useLoad("modal-organizations", () =>
    api.organizations(),
  );
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    mobile: "",
    roleId: "",
    projects: [] as string[],
    organizationId: "",
    programs: [] as string[],
  });
  const selectedRole = (roles.data ?? []).find(
    (role) => field(role, "_id", "id") === form.roleId,
  );
  const isClient = ["client", "promotional"].includes(
    field(selectedRole ?? {}, "role") as string,
  );
  const mergedOrganizations = filterAndSortOrganizations(
    organizations.data ?? [],
    "",
  );
  const selectedOrganization = mergedOrganizations.find(
    (organization) => organization.selectionId === form.organizationId,
  );
  const availablePrograms = selectedOrganization?.programs ?? [];
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isClient && !form.organizationId) {
      setError("Select an organization for the client user.");
      return;
    }
    if (isClient && form.programs.length === 0) {
      setError("Select at least one program for the client user.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        mobile: form.mobile.trim(),
        roleId: form.roleId,
        projects: isClient ? [] : form.projects,
        ...(isClient
          ? {
              organizationId: form.organizationId,
              programs: form.programs,
            }
          : {}),
      });
      onCreated();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create user",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add User" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <input
          aria-label="Full Name"
          placeholder="Full Name"
          value={form.fullName}
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
          required
        />
        <input
          aria-label="Email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          aria-label="Username"
          autoComplete="off"
          placeholder="Username"
          value={form.username}
          onChange={(event) =>
            setForm({ ...form, username: event.target.value })
          }
          required
        />
        <input
          aria-label="Phone Number"
          placeholder="Phone Number"
          value={form.mobile}
          onChange={(event) => setForm({ ...form, mobile: event.target.value })}
        />
        <SearchableSelect
          ariaLabel="Set role of User"
          value={form.roleId}
          onChange={(roleId) =>
            setForm({
              ...form,
              roleId,
              projects: [],
              organizationId: "",
              programs: [],
            })
          }
          options={(roles.data ?? []).map((role) => {
            const roleKey = field(role, "role");
            const unavailableAdmin =
              roleKey === "super_admin" && Number(field(role, "userCount")) > 0;
            return {
              value: field(role, "_id", "id"),
              label: `${field(role, "name", "role")}${unavailableAdmin ? " (already assigned)" : ""}`,
              disabled: unavailableAdmin,
            };
          })}
          placeholder="Set role of User"
          searchPlaceholder="Search roles…"
          required
        />
        {roles.error ? <p className="form-error">{roles.error}</p> : null}
        {isClient ? (
          <>
            <div className="organization-picker">
              <label>Search and select an organization</label>
              <SearchableSelect
                ariaLabel="Organization"
                value={form.organizationId}
                onChange={(organizationId) =>
                  setForm({
                    ...form,
                    organizationId,
                    programs: [],
                  })
                }
                options={mergedOrganizations.map((organization) => ({
                  value: organization.selectionId,
                  label: organization.name,
                }))}
                placeholder="Choose an organization…"
                searchPlaceholder="Search organizations…"
                required
              />
              <small>
                {mergedOrganizations.length} organizations available
              </small>
            </div>
            {organizations.error ? (
              <p className="form-error">{organizations.error}</p>
            ) : null}
            {form.organizationId ? (
              <fieldset>
                <legend>Set programs for Client</legend>
                {availablePrograms.length ? (
                  availablePrograms.map((program) => {
                    return (
                      <label key={program.id}>
                        <input
                          type="checkbox"
                          checked={form.programs.includes(program.id)}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              programs: event.target.checked
                                ? [...form.programs, program.id]
                                : form.programs.filter(
                                    (id) => id !== program.id,
                                  ),
                            })
                          }
                        />{" "}
                        {program.name}
                        {program.year ? ` (${program.year})` : ""}
                        {program.projectName ? ` — ${program.projectName}` : ""}
                      </label>
                    );
                  })
                ) : (
                  <span>No programs are assigned to this organization.</span>
                )}
              </fieldset>
            ) : null}
          </>
        ) : form.roleId ? (
          <fieldset>
            <legend>Set projects to User</legend>
            {(projects.data ?? []).map((project) => (
              <label key={project.id}>
                <input
                  type="checkbox"
                  checked={form.projects.includes(project.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      projects: event.target.checked
                        ? [...form.projects, project.id]
                        : form.projects.filter((id) => id !== project.id),
                    })
                  }
                />{" "}
                {project.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button compact" disabled={saving}>
            {saving ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: user.fullName,
    email: user.email,
    username: user.username ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.updateUser(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update user",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Edit ${user.fullName}`} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <input
          aria-label="Full Name"
          value={form.fullName}
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
          required
        />
        <input
          aria-label="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          aria-label="Username"
          value={form.username}
          onChange={(event) =>
            setForm({ ...form, username: event.target.value })
          }
        />
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button compact" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TemporaryPasswordModal({
  credential,
  onClose,
}: {
  credential: {
    username: string;
    email: string;
    temporaryPassword: string;
  };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(credential.temporaryPassword);
    setCopied(true);
  };
  return (
    <Modal title="Temporary password" onClose={onClose}>
      <p className="modal-description">
        This password is shown only once. Copy it now and send it to{" "}
        <strong>{credential.email}</strong> through a secure channel.
      </p>
      <div className="temporary-password">
        <code>{credential.temporaryPassword}</code>
        <button className="secondary-button small" onClick={() => void copy()}>
          <Copy size={15} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="modal-actions">
        <button className="primary-button compact" onClick={onClose}>
          I have saved it
        </button>
      </div>
    </Modal>
  );
}

export function PortalUsersPage() {
  return <UsersManagementPage />;
}

export function UsersManagementPage() {
  const loaded = useLoad("management-users", api.users);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [credential, setCredential] = useState<{
    username: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [resetting, setResetting] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const users = (loaded.data ?? []).filter((user) =>
    `${user.fullName} ${user.email} ${user.username ?? ""} ${user.organization?.name ?? ""} ${user.role ?? ""} ${JSON.stringify(user.payments)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const resetPassword = async (user: UserRecord) => {
    setResetting(user.id);
    setNotice("");
    try {
      setCredential(await api.resetUserPassword(user.id));
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "Password reset could not be sent.",
      );
    } finally {
      setResetting("");
    }
  };
  return (
    <>
      <PageHeader
        title="Users Management"
        actions={
          <button
            className="primary-button compact"
            onClick={() => setModal(true)}
          >
            + Add User
          </button>
        }
      />
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search users"
      />
      {notice ? <div className="notice">{notice}</div> : null}
      {loaded.loading ? (
        <State
          loading
          title="Loading users"
          message="Retrieving management users."
        />
      ) : loaded.error ? (
        <State title="Users unavailable" message={loaded.error} />
      ) : (
        <>
          <DataTable
            headers={[
              "User Full Name",
              "Email",
              "Username",
              "Role",
              "Organization",
              "Date Created",
              "Last Login",
              "Product Payments",
              "Total Paid",
              "Last Payment",
              "Status",
              "Actions",
            ]}
            rows={users.map((user) => {
              return [
                <strong>{user.fullName}</strong>,
                user.email,
                user.username ?? "—",
                user.role === "super_admin"
                  ? "Super Admin"
                  : user.role === "admin"
                    ? "Admin"
                    : (user.role ?? "—"),
                user.organization?.name ?? "—",
                formatDate(user.createdAt),
                formatDateTime(user.lastLogin),
                user.payments.length ? (
                  <div className="payment-status-list">
                    {user.payments.map((payment, index) => (
                      <div
                        className="payment-status-item"
                        key={`${payment.productId ?? payment.productName}-${payment.paymentDatetime ?? index}`}
                      >
                        <span>
                          <strong>{payment.productName}</strong>
                          {payment.programName ? (
                            <small>{payment.programName}</small>
                          ) : null}
                        </span>
                        <span
                          className="payment-status-pill"
                          data-status={payment.status.toLowerCase()}
                        >
                          {payment.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  "—"
                ),
                user.totalPaid.length
                  ? user.totalPaid
                      .map(({ amountMinor, currency }) =>
                        formatMoney(amountMinor, currency),
                      )
                      .join(" · ")
                  : formatMoney(0, "USD"),
                formatDateTime(user.lastPaymentDatetime),
                <span
                  className={
                    user.status === "ACTIVE"
                      ? "status-pill"
                      : "payment-status-pill"
                  }
                  data-status={user.status.toLowerCase()}
                >
                  {user.status.replaceAll("_", " ")}
                </span>,
                <div className="row-actions">
                  <button
                    className="icon-button"
                    title="Edit"
                    aria-label={`Edit ${user.fullName}`}
                    onClick={() => setEditing(user)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Reset password for ${user.fullName}`}
                    title="Reset password"
                    disabled={resetting === user.id}
                    onClick={() => void resetPassword(user)}
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    className="icon-button danger-text"
                    title="Delete"
                    aria-label={`Delete ${user.fullName}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${user.fullName}? This will disable their account and sign them out.`,
                        )
                      ) {
                        void api
                          .deleteUser(user.id)
                          .then(loaded.reload)
                          .catch((caught: unknown) =>
                            setNotice(
                              caught instanceof Error
                                ? caught.message
                                : "User could not be deleted.",
                            ),
                          );
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>,
              ];
            })}
          />
          <Pager count={loaded.data?.length ?? 0} shown={10} />
        </>
      )}
      {modal ? (
        <AddUserModal
          onClose={() => setModal(false)}
          onCreated={loaded.reload}
        />
      ) : null}
      {editing ? (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={loaded.reload}
        />
      ) : null}
      {credential ? (
        <TemporaryPasswordModal
          credential={credential}
          onClose={() => setCredential(null)}
        />
      ) : null}
    </>
  );
}

function GenericLogPage({
  title,
  kind,
}: {
  title: string;
  kind: "orders" | "activity";
}) {
  const loader = kind === "orders" ? api.orders : api.activity;
  const loaded = useLoad(kind, loader);
  const [search, setSearch] = useState("");
  const rows = (loaded.data ?? []).filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const headers =
    kind === "orders"
      ? [
          "Order Date",
          "Username",
          "Organization",
          "Product",
          "Amount Paid",
          "Payment Method",
          "Program",
          "Stripe Status",
        ]
      : ["Date", "Event", "Metadata"];
  const cells = (row: Record<string, unknown>) =>
    kind === "orders"
      ? [
          formatDate(row.createdAt ?? row.createAt),
          field(row, "purchaserUsername", "username"),
          field(row, "organizationName", "client", "Account_Name"),
          <OrderProductCell row={row} />,
          formatMoney(
            typeof row.amountMinor === "number"
              ? row.amountMinor
              : typeof row.amount === "number"
                ? row.amount
                : 0,
            typeof row.currency === "string" ? row.currency : "USD",
          ),
          field(row, "paymentMethod"),
          field(row, "programName", "program"),
          <span className="status-pill">
            {field(row, "status", "stripeStatus")}
          </span>,
        ]
      : [
          formatDateTime(row.createdAt ?? row.createAt),
          field(row, "description", "action", "message"),
          <code className="metadata-cell">
            {JSON.stringify(row.after ?? row.metadata ?? {})}
          </code>,
        ];
  return (
    <>
      <PageHeader title={title} />
      {kind === "orders" ? <h2 className="section-title">Reports</h2> : null}
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder={kind === "orders" ? "Product Search" : "Search Activity"}
      />
      {loaded.loading ? (
        <State
          loading
          title={`Loading ${title.toLowerCase()}`}
          message="Retrieving records."
        />
      ) : loaded.error ? (
        <State title={`${title} unavailable`} message={loaded.error} />
      ) : (
        <>
          <DataTable
            headers={headers}
            rows={rows.map(cells)}
            empty={`No ${title} Found!`}
          />
          <Pager count={rows.length} shown={10} />
        </>
      )}
    </>
  );
}

const sortingFilterLabels: Record<string, string> = {
  agegeneration: "Age Generation",
  department: "Department",
  employmentlength: "Employment Length",
  ethnicorigin: "Race/Ethnicity",
  gender: "Gender",
  joblevel: "Job Level",
  jobstatus: "Job Status",
  race: "Race/Ethnicity",
  workplacesetting: "Workplace Setting",
};

function sortingFilterLabel(value: string): string {
  const normalized = value.replace(/[^a-z0-9]/giu, "").toLowerCase();
  return (
    sortingFilterLabels[normalized] ??
    value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function OrderProductCell({ row }: { row: Record<string, unknown> }) {
  const product = field(row, "productName", "product", "itemTitle");
  const rawFilter = field(row, "sortingFilter");
  if (rawFilter === "—") return <>{product}</>;
  const resolvedFilter = field(row, "sortingFilterLabel");
  const label =
    resolvedFilter === "—"
      ? sortingFilterLabel(rawFilter)
      : sortingFilterLabel(resolvedFilter);
  const productWithoutFilter = product
    .replace(
      new RegExp(
        `\\s*\\(?(?:${escapeRegExp(rawFilter)}|${escapeRegExp(label)})\\)?\\s*$`,
        "iu",
      ),
      "",
    )
    .trim();
  const displayProduct = productWithoutFilter || product;
  const sortedVerbatimsMatch = /Sorted Employee Verbatims/iu.exec(
    displayProduct,
  );
  if (!sortedVerbatimsMatch) return <>{displayProduct}</>;
  const sortedVerbatimsStart = sortedVerbatimsMatch.index;
  const sortedVerbatimsEnd =
    sortedVerbatimsStart + sortedVerbatimsMatch[0].length;
  return (
    <>
      {displayProduct.slice(0, sortedVerbatimsStart)}
      {sortedVerbatimsMatch[0]} <strong>({label})</strong>
      {displayProduct.slice(sortedVerbatimsEnd)}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const OrderLogPage = () => (
  <GenericLogPage title="Order Log" kind="orders" />
);
export const ActivityLogPage = () => (
  <GenericLogPage title="Activity Log" kind="activity" />
);

function AddRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createRole(name, permissions);
      onCreated();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create role",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add Role" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <input
          aria-label="Enter Role Name"
          placeholder="Enter Role Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <fieldset className="permission-list">
          {Object.entries(permissionLabels).map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={permissions.includes(key)}
                onChange={(event) =>
                  setPermissions(
                    event.target.checked
                      ? [...permissions, key]
                      : permissions.filter((permission) => permission !== key),
                  )
                }
              />
            </label>
          ))}
        </fieldset>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button compact" disabled={saving}>
            {saving ? "Creating…" : "Create Role"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RolesPage() {
  const loaded = useLoad("roles", api.roles);
  const [modal, setModal] = useState(false);
  return (
    <>
      <PageHeader
        title="Role Permissions"
        breadcrumb="Role Permissions"
        actions={
          <button
            className="primary-button compact"
            onClick={() => setModal(true)}
          >
            + Add New Role
          </button>
        }
      />
      {loaded.loading ? (
        <State
          loading
          title="Loading roles"
          message="Retrieving permissions."
        />
      ) : (
        <>
          <DataTable
            headers={["Role", "Users", "Actions"]}
            rows={(loaded.data ?? []).map((role) => [
              <strong>{field(role, "name", "role")}</strong>,
              field(role, "userCount", "users"),
              <button
                className="more-button"
                aria-label={`Actions for ${field(role, "name", "role")}`}
              >
                <MoreHorizontal size={18} />
              </button>,
            ])}
          />
          <Pager count={loaded.data?.length ?? 0} shown={10} />
        </>
      )}
      {modal ? (
        <AddRoleModal
          onClose={() => setModal(false)}
          onCreated={loaded.reload}
        />
      ) : null}
    </>
  );
}
