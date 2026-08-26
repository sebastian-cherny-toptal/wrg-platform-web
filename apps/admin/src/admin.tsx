import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
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
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";
import { WorkforceLogoWhite } from "@wrg/platform-ui";
import {
  api,
  field,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  type OrganizationRecord,
  type PortalUserRecord,
  type ProgramRecord,
  type ProjectRecord,
  type UserRecord,
} from "./api";
import { useAuth } from "./auth";
import { CatalogEditor } from "./catalog-editor";
import { filterAndSortOrganizations } from "./organization-options";

const permissionLabels: Record<string, string> = {
  clientsProjectsProgramsAccess: "Access Shared Projects, Programs & Clients",
  syncCheckmartketAndZohoAccess: "Manually Re-Sync Checkmarket & Zoho Data",
  previewClientsDashboardAccess: "Preview Clients' Dashboards",
  exportReportsAccess: "Export Reports",
  uploadDownloadCustomReportAccess: "Upload & Download Custom Reports",
  uploadKeyImpactAnalysisAccess: "Upload Key Impact Analysis",
  orderLogAccess: "Access Order Logs",
};

const navigation = [
  {
    to: "/admin/projects",
    label: "Projects & Programs",
    icon: BriefcaseBusiness,
  },
  {
    to: "/admin/projects/import",
    label: "Import Historical Project",
    icon: FileUp,
  },
  { to: "/admin/users", label: "Users Management", icon: Users },
  { to: "/admin/order-log", label: "Order Log", icon: ClipboardList },
  { to: "/admin/system-log", label: "Activity Log", icon: Activity },
  { to: "/admin/role-permissions", label: "Roles", icon: ShieldCheck },
];

function useLoad<T>(key: string, loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    setError("");
    loader()
      .then(setData)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load data",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(reload, [key]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <select
            className="select-button"
            aria-label="Sort records"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
  empty = "No data found",
}: {
  headers: string[];
  rows: ReactNode[][];
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
              <tr key={rowIndex}>
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

function Pager({ count, shown }: { count: number; shown: number }) {
  return (
    <div className="pager">
      <span>
        {Math.min(shown, count)} out of {count}
      </span>
      <div>
        <button disabled>‹</button>
        <button className="current">1</button>
        <button disabled={count <= shown}>›</button>
      </div>
    </div>
  );
}

export function AdminShell() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
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
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
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
  const loaded = useLoad("projects", api.projects);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
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
      <PageHeader
        title="Projects"
        breadcrumb="Projects & Programs"
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
              <Link className="action-link" to={`/admin/projects/${item.id}`}>
                View Details <ChevronRight size={18} />
              </Link>,
            ])}
          />
          <Pager count={rows.length} shown={10} />
        </>
      )}
    </>
  );
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const loaded = useLoad(`project:${projectId}`, () => api.project(projectId));
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [expanded, setExpanded] = useState(false);
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
  return (
    <>
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
            <Link className="action-link" to={`/admin/projects/${project.id}/programs/${item.id}/edit`}>Edit program <ChevronRight size={17} /></Link>
            <Link className="action-link" to={`/admin/projects/${project.id}/programs/${item.id}`}>View Details <ChevronRight size={18} /></Link>
          </div>,
        ])}
      />
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

export function ProgramDetailPage() {
  const { projectId = "", programId = "" } = useParams();
  const { auth } = useAuth();
  const programLoaded = useLoad(`program:${programId}`, () =>
    api.program(programId),
  );
  const organizationsLoaded = useLoad(`organizations:${programId}`, () =>
    api.organizations(programId),
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("id:asc");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadOrganization, setUploadOrganization] =
    useState<OrganizationRecord | null>(null);
  const [previewOrganization, setPreviewOrganization] =
    useState<OrganizationRecord | null>(null);
  const [catalogOrganization, setCatalogOrganization] =
    useState<OrganizationRecord | null>(null);
  const program = programLoaded.data;
  const canUploadBenefits =
    auth?.user.roles.some(
      (role) => role === "admin" || role === "super_admin",
    ) || auth?.user.permissions.includes("ops.manage");
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
      if (sort === "name:asc") return left.name.localeCompare(right.name);
      if (sort === "surveys:desc") return right.surveysSent - left.surveysSent;
      if (sort === "winners:first" || sort === "winners:last") {
        const winnerOrder = Number(right.isWinner) - Number(left.isWinner);
        const primary = sort === "winners:first" ? winnerOrder : -winnerOrder;
        return primary || left.name.localeCompare(right.name);
      }
      return left.sourceId.localeCompare(right.sourceId, undefined, {
        numeric: true,
      });
    });
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
  const resync = async () => {
    if (!window.confirm(`Re-sync all deals for ${program.name}?`)) return;
    setNotice("Starting synchronization…");
    try {
      await api.resyncProgram(program.id);
      setNotice("Synchronization was queued successfully.");
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "Synchronization could not be queued.",
      );
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
      <button
        className={expanded ? "details-toggle expanded" : "details-toggle"}
        onClick={() => setExpanded((value) => !value)}
      >
        <strong>Program Details</strong>
        <ChevronDown size={18} />
      </button>
      {expanded ? (
        <div className="details-panel details-grid">
          <Detail label="Program ID" value={program.id} />
          <Detail
            label="Program Year"
            value={program.year ? String(program.year) : "—"}
          />
          <Detail
            label="Number of Organizations"
            value={String(program.organizationCount || organizations.length)}
          />
          <Detail label="EFS Launch Date" value={formatCalendarDate(details.StartDate ?? details.startsAt)} />
          <Detail label="EFS Deadline" value={formatCalendarDate(details.EndDate ?? details.endsAt)} />
          <Detail
            label="Winners Count"
            value={String(program.winnersCount)}
          />
        </div>
      ) : null}
      <div className="section-row">
        <h2 className="section-title">Organization</h2>
        <div className="row-actions">
          <Link className="secondary-button compact action-link" to={`/admin/projects/${projectId}/programs/${program.id}/edit`}>Edit program <ChevronRight size={16} /></Link>
          <button className="primary-button compact" onClick={() => void resync()}>Re-Sync All Deals</button>
        </div>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
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
          { value: "name:asc", label: "Organization name" },
          { value: "surveys:desc", label: "Most surveys sent" },
          { value: "winners:first", label: "Winners first" },
          { value: "winners:last", label: "Winners last" },
        ]}
      />
      <DataTable
        headers={[
          "Organization ID",
          "Organization Name",
          "Date Added",
          "Current Stage",
          "Last Time Synced",
          "No. of Surveys Sent",
          "Winner",
          "Actions",
        ]}
        rows={organizations.map((item) => [
          <strong>{item.sourceId}</strong>,
          item.name,
          formatDate(item.createdAt),
          item.stage ?? "—",
          formatDate(item.lastSyncedAt),
          item.surveysSent,
          item.isWinner ? "Y" : "N",
          <div className="row-actions">
            <button
              className="action-link button-link"
              onClick={() => setPreviewOrganization(item)}
            >
              View Dashboard <ChevronRight size={18} />
            </button>
            {canUploadBenefits ? (
              <button className="action-link button-link" onClick={() => setCatalogOrganization(item)}>
                Configure store <ShoppingBag size={17} />
              </button>
            ) : null}
            {canUploadBenefits ? (
              <button
                className="action-link button-link"
                onClick={() => setUploadOrganization(item)}
              >
                Upload B&amp;BP <FileUp size={17} />
              </button>
            ) : null}
          </div>,
        ])}
      />
      <Pager count={organizations.length} shown={10} />
      {previewOrganization ? (
        <ImpersonationUserModal
          organization={previewOrganization}
          program={program}
          onClose={() => setPreviewOrganization(null)}
        />
      ) : null}
      {uploadOrganization ? (
        <BenefitsBestPracticesUploadModal
          organization={uploadOrganization}
          program={program}
          onClose={() => setUploadOrganization(null)}
          onUploaded={(fileName) => {
            setNotice(
              `${fileName} is now the Benefits & Best Practices workbook for ${uploadOrganization.name} in ${program.name}.`,
            );
            setUploadOrganization(null);
            organizationsLoaded.reload();
          }}
        />
      ) : null}
      {catalogOrganization ? <CatalogModal scope={{ kind: "organization", id: catalogOrganization.organizationProgramId, label: `${catalogOrganization.name} — ${program.name}` }} onClose={() => setCatalogOrganization(null)} onSaved={() => setNotice(`The report store was updated for ${catalogOrganization.name}.`)} /> : null}
    </>
  );
}

function CatalogModal({ scope, onClose, onSaved }: { scope: { kind: "program" | "organization"; id: string; label: string }; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<import("./api").ReportProduct[]>([]);
  const [inherit, setInherit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api.reportProductTemplates(), scope.kind === "program" ? api.programCatalog(scope.id) : api.organizationCatalog(scope.id)])
      .then(([templates, configured]) => {
        if (!active) return;
        const selected = Array.isArray(configured) ? configured : configured.products;
        setProducts(templates.map((template) => selected.find(({ id }) => id === template.id) ?? { ...template, available: false }));
        if (!Array.isArray(configured)) setInherit(configured.inherited);
      }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load catalog")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [scope.id, scope.kind]);
  const save = async () => {
    setSaving(true); setError("");
    try {
      if (scope.kind === "program") await api.saveProgramCatalog(scope.id, products);
      else await api.saveOrganizationCatalog(scope.id, products, inherit);
      onSaved(); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save catalog"); setSaving(false); }
  };
  return <Modal title={`Configure report store — ${scope.label}`} onClose={onClose}>
    {scope.kind === "organization" ? <label className="inherit-catalog"><input type="checkbox" checked={inherit} onChange={(event) => setInherit(event.target.checked)} /><span><strong>Use program catalog</strong><small>Keep this organization synchronized with program-wide products and prices.</small></span></label> : null}
    {loading ? <p className="modal-copy">Loading catalog…</p> : inherit ? <p className="notice">This organization currently uses the program catalog. Turn off the option above to customize it.</p> : <CatalogEditor products={products} onChange={setProducts} />}
    {error ? <p className="form-error">{error}</p> : null}
    <div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-button" onClick={() => void save()} disabled={saving || loading}>{saving ? "Saving…" : "Save catalog"}</button></div>
  </Modal>;
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
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

function BenefitsBestPracticesUploadModal({
  organization,
  program,
  onClose,
  onUploaded,
}: {
  organization: OrganizationRecord;
  program: ProgramRecord;
  onClose: () => void;
  onUploaded: (fileName: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Choose an .xlsx workbook to upload.");
      return;
    }
    if (!/\.xlsx$/iu.test(file.name)) {
      setError("The selected file must be an .xlsx workbook.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("The selected workbook must be 25 MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await api.uploadBenefitsBestPracticesWorkbook(
        organization.organizationProgramId,
        file,
      );
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
    <Modal title="Upload Benefits & Best Practices" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <p className="modal-copy">
          Upload the report workbook for <strong>{organization.name}</strong> in{" "}
          <strong>{program.name}</strong>. A new upload replaces this
          organization&apos;s current Benefits &amp; Best Practices data.
        </p>
        {organization.benefitsBestPracticesFileName ? (
          <p className="current-upload">
            Current workbook:{" "}
            <strong>{organization.benefitsBestPracticesFileName}</strong>
          </p>
        ) : null}
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
  const [organizationSearch, setOrganizationSearch] = useState("");
  const selectedRole = (roles.data ?? []).find(
    (role) => field(role, "_id", "id") === form.roleId,
  );
  const isClient = ["client", "promotional"].includes(field(selectedRole ?? {}, "role") as string);
  const mergedOrganizations = filterAndSortOrganizations(
    organizations.data ?? [],
    "",
  );
  const selectedOrganization = mergedOrganizations.find(
    (organization) => organization.id === form.organizationId,
  );
  const organizationOptions = filterAndSortOrganizations(
    organizations.data ?? [],
    organizationSearch,
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
        <select
          aria-label="Set role of User"
          value={form.roleId}
          onChange={(event) =>
            setForm({
              ...form,
              roleId: event.target.value,
              projects: [],
              organizationId: "",
              programs: [],
            })
          }
          required
        >
          <option value="">Set role of User</option>
          {(roles.data ?? []).map((role) => {
            const roleKey = field(role, "role");
            const unavailableAdmin =
              roleKey === "super_admin" && Number(field(role, "userCount")) > 0;
            return (
              <option
                key={field(role, "_id", "id")}
                value={field(role, "_id", "id")}
                disabled={unavailableAdmin}
              >
                {field(role, "name", "role")}
                {unavailableAdmin ? " (already assigned)" : ""}
              </option>
            );
          })}
        </select>
        {roles.error ? <p className="form-error">{roles.error}</p> : null}
        {isClient ? (
          <>
            <div className="organization-picker">
              <label htmlFor="organization-search">
                Search and select an organization
              </label>
              <input
                aria-label="Search organizations"
                id="organization-search"
                type="search"
                placeholder="Type an organization name…"
                value={organizationSearch}
                onChange={(event) => setOrganizationSearch(event.target.value)}
              />
              <select
                aria-describedby="organization-search-status"
                aria-label="Organization"
                value={form.organizationId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    organizationId: event.target.value,
                    programs: [],
                  })
                }
                required
              >
                <option value="">Choose an organization…</option>
                {organizationOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <small id="organization-search-status">
                {organizationSearch
                  ? `${organizationOptions.length} matching organization${organizationOptions.length === 1 ? "" : "s"}`
                  : `${organizationOptions.length} organizations available`}
              </small>
            </div>
            {organizationSearch && organizationOptions.length === 0 ? (
              <p className="form-hint">No organizations match that search.</p>
            ) : null}
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
    `${user.fullName} ${user.email} ${user.username ?? ""} ${user.organization?.name ?? ""} ${user.role ?? ""}`
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
                <span className="status-pill">Active</span>,
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${user.fullName}`}
                    onClick={() => setEditing(user)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Reset password for ${user.fullName}`}
                    disabled={resetting === user.id}
                    onClick={() => void resetPassword(user)}
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    className="icon-button danger-text"
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
          "Product",
          "Payment Method",
          "Client",
          "Program",
          "Stripe Status",
        ]
      : ["Date", "Event", "Metadata"];
  const cells = (row: Record<string, unknown>) =>
    kind === "orders"
      ? [
          formatDate(row.createdAt ?? row.createAt),
          field(row, "product", "productName", "items"),
          field(row, "paymentMethod"),
          field(row, "client", "organizationName", "Account_Name"),
          field(row, "program", "programName"),
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
