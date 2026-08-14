import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  KeyRound,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserRound,
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
  formatDate,
  type OrganizationRecord,
  type PortalUserRecord,
  type ProgramRecord,
  type ProjectRecord,
} from "./api";
import { useAuth } from "./auth";

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
  { to: "/admin/users", label: "Portal Users", icon: Users },
  { to: "/admin/users-management", label: "Users Management", icon: KeyRound },
  { to: "/admin/order-log", label: "Order Log", icon: ClipboardList },
  { to: "/admin/system-log", label: "Activity Log", icon: Activity },
  {
    to: "/admin/user-login-sessions",
    label: "User Login Sessions",
    icon: UserRound,
  },
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

function State({
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

function PageHeader({
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
}: {
  search: string;
  setSearch: (value: string) => void;
  placeholder: string;
  date?: string;
  setDate?: (value: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="select-button">
          Sort by Date <ChevronDown size={15} />
        </button>
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
  const rows = useMemo(
    () =>
      (loaded.data ?? []).filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) &&
          (!date || item.createdAt?.slice(0, 10) === date),
      ),
    [loaded.data, search, date],
  );
  return (
    <>
      <PageHeader title="Projects" breadcrumb="Projects & Programs" />
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search Projects"
        date={date}
        setDate={setDate}
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
              "Programs",
              "Actions",
            ]}
            rows={rows.slice(0, 10).map((item) => [
              <strong>{item.name}</strong>,
              formatDate(item.createdAt),
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
          <Link
            className="action-link"
            to={`/admin/projects/${project.id}/programs/${item.id}`}
          >
            View Details <ChevronRight size={18} />
          </Link>,
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
  const programLoaded = useLoad(`program:${programId}`, () =>
    api.program(programId),
  );
  const organizationsLoaded = useLoad(`organizations:${programId}`, () =>
    api.organizations(programId),
  );
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewOrganization, setPreviewOrganization] =
    useState<OrganizationRecord | null>(null);
  const program = programLoaded.data;
  const normalizedSearch = search.toLowerCase();
  const organizations = (organizationsLoaded.data ?? []).filter(
    (item) =>
      (item.name.toLowerCase().includes(normalizedSearch) ||
        item.sourceId.toLowerCase().includes(normalizedSearch) ||
        item.sourceName?.toLowerCase().includes(normalizedSearch)) &&
      (!date || item.createdAt?.slice(0, 10) === date),
  );
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
          <Detail
            label="Employee Survey ID"
            value={field(details, "Employee_Survey_ID", "employeeSurveyId")}
          />
          <Detail
            label="Employer Survey ID"
            value={field(details, "Employer_Survey_ID", "employerSurveyId")}
          />
          <Detail
            label="Winners Count"
            value={field(details, "winnersCount")}
          />
        </div>
      ) : null}
      <div className="section-row">
        <h2 className="section-title">Organization</h2>
        <button
          className="primary-button compact"
          onClick={() => void resync()}
        >
          Re-Sync All Deals
        </button>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search organization IDs or names"
        date={date}
        setDate={setDate}
      />
      <DataTable
        headers={[
          "Organization ID",
          "Organization Name",
          "Date Added",
          "Current Stage",
          "Last Time Synced",
          "No. of Surveys Sent",
          "Actions",
        ]}
        rows={organizations.map((item) => [
          <strong>{item.sourceId}</strong>,
          item.name,
          formatDate(item.createdAt),
          item.stage ?? "—",
          formatDate(item.lastSyncedAt),
          item.surveysSent,
          <button
            className="action-link button-link"
            onClick={() => setPreviewOrganization(item)}
          >
            View Dashboard <ChevronRight size={18} />
          </button>,
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
    </>
  );
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
  const isClient = field(selectedRole ?? {}, "role") === "client";
  const selectedOrganization = (organizations.data ?? []).find(
    (organization) => organization.id === form.organizationId,
  );
  const availablePrograms = selectedOrganization?.programs ?? [];
  const selectedProjectId = availablePrograms.find((program) =>
    form.programs.includes(program.id),
  )?.projectId;
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
              roleKey === "admin" && Number(field(role, "userCount")) > 0;
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
            <select
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
              <option value="">Select organization</option>
              {(organizations.data ?? []).map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            {organizations.error ? (
              <p className="form-error">{organizations.error}</p>
            ) : null}
            {form.organizationId ? (
              <fieldset>
                <legend>Set programs for Client</legend>
                {availablePrograms.length ? (
                  availablePrograms.map((program) => {
                    const disabled = Boolean(
                      selectedProjectId &&
                        program.projectId !== selectedProjectId &&
                        !form.programs.includes(program.id),
                    );
                    return (
                      <label key={program.id}>
                        <input
                          type="checkbox"
                          checked={form.programs.includes(program.id)}
                          disabled={disabled}
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
                        {program.projectName
                          ? ` — ${program.projectName}`
                          : ""}
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

export function PortalUsersPage() {
  const loaded = useLoad("portal-users", api.organizations);
  const [search, setSearch] = useState("");
  const users = (loaded.data ?? [])
    .flatMap((organization) =>
      organization.users.map((user) => ({
        ...user,
        organization: organization.name,
      })),
    )
    .filter((user) =>
      `${user.fullName} ${user.email} ${user.organization}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageHeader title="Users" />
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="User Search"
      />
      {loaded.loading ? (
        <State
          loading
          title="Loading users"
          message="Retrieving portal users."
        />
      ) : (
        <>
          <DataTable
            headers={[
              "User Full Name",
              "Email",
              "Organization",
              "Username",
              "Actions",
            ]}
            rows={users.map((user) => [
              <strong>{user.fullName}</strong>,
              user.email,
              user.organization,
              user.username ?? "—",
              <button
                className="more-button"
                aria-label={`Actions for ${user.fullName}`}
              >
                <MoreHorizontal size={18} />
              </button>,
            ])}
          />
          <Pager count={users.length} shown={10} />
        </>
      )}
    </>
  );
}

export function UsersManagementPage() {
  const loaded = useLoad("management-users", api.users);
  const [modal, setModal] = useState(false);
  const [resetting, setResetting] = useState("");
  const [notice, setNotice] = useState("");
  const resetPassword = async (user: Record<string, unknown>) => {
    const id = field(user, "id", "_id");
    if (id === "—") return;
    setResetting(id);
    setNotice("");
    try {
      await api.resetUserPassword(id);
      setNotice(`Password reset sent to ${field(user, "email")}.`);
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
              "Date Created",
              "Credentials",
              "Password",
            ]}
            rows={(loaded.data ?? []).map((user) => {
              const id = field(user, "id", "_id");
              return [
                <strong>{field(user, "fullName", "name")}</strong>,
                field(user, "email"),
                field(user, "username"),
                field(user, "role"),
                formatDate(user.createdAt),
                <span className="status-pill">Active</span>,
                <button
                  className="secondary-button small"
                  disabled={resetting === id}
                  onClick={() => void resetPassword(user)}
                >
                  {resetting === id ? "Sending…" : "Reset"}
                </button>,
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
    </>
  );
}

function GenericLogPage({
  title,
  kind,
}: {
  title: string;
  kind: "orders" | "activity" | "sessions";
}) {
  const loader =
    kind === "orders"
      ? api.orders
      : kind === "activity"
        ? api.activity
        : api.sessions;
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
      : kind === "activity"
        ? ["Date", "Description", "Status"]
        : ["Username", "Organization", "Email", "Login session time"];
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
      : kind === "activity"
        ? [
            formatDate(row.createdAt ?? row.createAt),
            field(row, "description", "action", "message"),
            <span className="status-pill">
              {field(row, "status", "outcome")}
            </span>,
          ]
        : [
            field(row, "username"),
            field(row, "organization", "organizationName"),
            field(row, "email"),
            formatDate(row.loginTime ?? row.createdAt),
          ];
  return (
    <>
      <PageHeader title={title} />
      {kind === "orders" ? <h2 className="section-title">Reports</h2> : null}
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder={
          kind === "orders"
            ? "Product Search"
            : kind === "sessions"
              ? "Hit Enter To Search"
              : "Search Activity"
        }
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
  <GenericLogPage title="System Log" kind="activity" />
);
export const LoginSessionsPage = () => (
  <GenericLogPage title="User Login Sessions" kind="sessions" />
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
