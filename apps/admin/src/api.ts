import { z } from "zod";

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const authStorageKey = "wrg-admin-auth";
export const adminAuthChangedEvent = "wrg-admin-auth-changed";

export type AdminIdentity = {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions: string[];
};

export type AdminAuth = {
  accessToken: string;
  refreshToken: string;
  user: AdminIdentity;
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string | null;
  programs: ProgramRecord[];
};

export type ProgramRecord = {
  id: string;
  name: string;
  year: number | null;
  createdAt: string | null;
  organizationCount: number;
  projectId?: string;
  details?: Record<string, unknown>;
};

export type ZohoProgramOption = {
  id: string;
  name: string;
  year: number | null;
  efsLaunchDate: string | null;
  efsDeadline: string | null;
};

export type PortalUserRecord = {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
};

export type UserRecord = {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string | null;
  roleId: string | null;
  organization: { id: string; name: string } | null;
  projects: Array<{ id: string; name: string }>;
  createdAt: string | null;
  lastLogin: string | null;
  status: string;
};

export type HistoricalImportMetadata = {
  projectId?: string;
  projectName?: string;
  programId?: string;
  zohoProgramId?: string;
  programName: string;
  programYear: number;
  projectAbbreviation?: string;
  efsLaunchDate: string;
  efsDeadline: string;
  organizationPrograms?: Array<{
    organizationProgramId?: string;
    organizationKey?: string;
    organizationName?: string;
    surveysSent: number;
    isWinner: boolean;
  }>;
  reportCatalog?: ReportProduct[];
};

export type ReportProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
};

export type OrganizationCatalog = {
  inherited: boolean;
  products: ReportProduct[];
};

export type HistoricalImportValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type HistoricalImportWorkbookSummary = {
  kind: "EA" | "EFS";
  fileName: string;
  sha256: string;
  questions: number;
  organizations: number;
  respondents: number;
  responses: number;
};

export type HistoricalImportOrganizationSummary = {
  key: string;
  displayName: string;
  workbookOrganizationId?: string;
  eaRespondents: number;
  efsRespondents: number;
  warnings: string[];
};

export type HistoricalImportValidationSummary = {
  issues: HistoricalImportValidationIssue[];
  workbooks: HistoricalImportWorkbookSummary[];
  organizations: HistoricalImportOrganizationSummary[];
  blockingErrorCount: number;
  warningCount: number;
};

export type HistoricalImportStatus = {
  importId: string;
  status: "draft" | "validated" | "committing" | "succeeded" | "failed";
  metadata: HistoricalImportMetadata;
  validation?: HistoricalImportValidationSummary;
  projectId?: string;
  projectName?: string;
  programId?: string;
  error?: string;
};

export type OrganizationRecord = {
  id: string;
  sourceId: string;
  sourceName: string | null;
  name: string;
  createdAt: string | null;
  stage: string | null;
  lastSyncedAt: string | null;
  surveysSent: number;
  isWinner: boolean;
  organizationProgramId: string;
  benefitsBestPracticesFileName: string | null;
  programs: Array<{
    id: string;
    name: string;
    year: number | null;
    projectId: string;
    projectName: string;
  }>;
  users: PortalUserRecord[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function readAuth(): AdminAuth | null {
  try {
    const raw = window.sessionStorage.getItem(authStorageKey);
    if (!raw) return null;
    const parsed = z
      .object({
        accessToken: z.string().min(1),
        refreshToken: z.string().min(1),
        user: z.object({
          id: z.string(),
          displayName: z.string(),
          email: z.string(),
          roles: z.array(z.string()),
          permissions: z.array(z.string()),
        }),
      })
      .safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function persistAuth(auth: AdminAuth | null): void {
  if (auth) window.sessionStorage.setItem(authStorageKey, JSON.stringify(auth));
  else window.sessionStorage.removeItem(authStorageKey);
  window.dispatchEvent(new Event(adminAuthChangedEvent));
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = readAuth();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(auth?.accessToken),
      ...(options.headers ?? {}),
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth?.accessToken) persistAuth(null);
    const body = object(payload);
    const nested = object(body.error);
    throw new ApiError(
      stringValue(body.message) ||
        stringValue(body.msg) ||
        stringValue(nested.message) ||
        "Request failed",
      response.status,
    );
  }
  return payload as T;
}

function identity(raw: unknown, emailFallback: string): AdminIdentity {
  const value = object(raw);
  const role = object(value.roleId);
  const roles = [stringValue(value.role), stringValue(role.role)].filter(
    Boolean,
  );
  const permissions = array(role.permissions).map(String);
  return {
    id: stringValue(value._id) || stringValue(value.id),
    displayName:
      stringValue(value.fullName) ||
      stringValue(value.name) ||
      emailFallback.split("@")[0] ||
      "Administrator",
    email: stringValue(value.email) || emailFallback,
    roles: roles.length ? roles : ["admin"],
    permissions,
  };
}

function decodePrincipal(accessToken: string): {
  roles: string[];
  permissions: string[];
  sub: string;
} {
  try {
    const payload = JSON.parse(
      atob(
        accessToken.split(".")[1]?.replaceAll("-", "+").replaceAll("_", "/") ??
          "",
      ),
    ) as Record<string, unknown>;
    return {
      sub: stringValue(payload.sub),
      roles: array(payload.roles).map(String),
      permissions: array(payload.permissions).map(String),
    };
  } catch {
    return { sub: "", roles: [], permissions: [] };
  }
}

function program(raw: unknown): ProgramRecord {
  const value = object(raw);
  const organizations = array(value.orgs ?? value.organizations);
  return {
    id:
      stringValue(value.databaseId) ||
      stringValue(value._id) ||
      stringValue(value.id),
    name: stringValue(value.Name) || stringValue(value.name),
    year: Number.isFinite(Number(value.Program_Year ?? value.year))
      ? Number(value.Program_Year ?? value.year)
      : null,
    createdAt:
      stringValue(value.createAt) || stringValue(value.createdAt) || null,
    organizationCount: Number(
      value.numberOfOrganizations ??
        value.Number_of_Organizations ??
        organizations.length ??
        0,
    ),
    projectId: stringValue(object(value.Project)._id) || undefined,
    details: value,
  };
}

function project(raw: unknown): ProjectRecord {
  const value = object(raw);
  return {
    id: stringValue(value._id) || stringValue(value.id),
    name: stringValue(value.Name) || stringValue(value.name),
    createdAt:
      stringValue(value.createAt) || stringValue(value.createdAt) || null,
    programs: array(value.Programs ?? value.programs).map(program),
  };
}

export function organization(raw: unknown): OrganizationRecord {
  const value = object(raw);
  const organizationPrograms = array(value.orgPrograms);
  const enrollment = object(object(organizationPrograms[0]).orgs);
  const benefitsBestPractices = object(
    object(enrollment.publishedReports).benefitsBestPractices,
  );
  const id = stringValue(value._id) || stringValue(value.id);
  const sourceId =
    stringValue(value.sourceOrganizationId) ||
    stringValue(enrollment.Source_Organization_ID) ||
    id;
  const sourceName =
    stringValue(value.sourceOrganizationName) ||
    stringValue(enrollment.Source_Organization_Name) ||
    null;
  const storedName =
    stringValue(value.Alias_Company_Name) ||
    stringValue(value.Account_Name) ||
    stringValue(value.name);
  const name = sourceName && sourceName !== sourceId ? sourceName : storedName;
  return {
    id,
    sourceId,
    sourceName,
    name,
    createdAt:
      stringValue(enrollment.Created_Time) ||
      stringValue(value.createAt) ||
      null,
    stage: stringValue(enrollment.Stage) || null,
    lastSyncedAt: stringValue(enrollment.Last_time_deal_synced) || null,
    surveysSent: Number(enrollment.Surveys_Sent ?? 0),
    isWinner: enrollment.isWinner === true,
    organizationProgramId:
      stringValue(enrollment.databaseId) ||
      stringValue(enrollment._id) ||
      stringValue(enrollment.id),
    benefitsBestPracticesFileName:
      stringValue(benefitsBestPractices.sourceFile) || null,
    programs: organizationPrograms
      .map((entry) => {
        const access = object(object(entry).orgs);
        const reference = object(array(access.programId)[0]);
        const yearValue = reference.Program_Year ?? reference.year;
        return {
          id: stringValue(reference._id) || stringValue(reference.id),
          name: stringValue(reference.Name) || stringValue(reference.name),
          year: Number.isFinite(Number(yearValue)) ? Number(yearValue) : null,
          projectId: stringValue(access.projectId),
          projectName: stringValue(access.projectName),
        };
      })
      .filter(({ id }) => Boolean(id)),
    users: array(value.users).map((entry) => {
      const user = object(entry);
      return {
        id: stringValue(user.id) || stringValue(user._id),
        fullName:
          stringValue(user.fullName) ||
          stringValue(user.name) ||
          stringValue(user.username),
        email: stringValue(user.email),
        username: stringValue(user.username) || null,
      };
    }),
  };
}

export const api = {
  async startLogin(
    email: string,
    password: string,
  ): Promise<{ userId: string; requiresOtp: boolean }> {
    const response = await request<unknown>("/user/management/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = object(object(response).data);
    return {
      userId: stringValue(data.userId),
      requiresOtp: data["2faVerified"] === true,
    };
  },

  async completeLogin(
    email: string,
    userId: string,
    enteredOtp?: string,
  ): Promise<AdminAuth> {
    const response = await request<unknown>("/user/management/login", {
      method: "PUT",
      body: JSON.stringify({ userId, ...(enteredOtp ? { enteredOtp } : {}) }),
    });
    const data = object(object(response).data);
    const accessToken = stringValue(data.accessToken);
    const principal = decodePrincipal(accessToken);
    const user = identity(data.user, email);
    const auth: AdminAuth = {
      accessToken,
      refreshToken: stringValue(data.refreshToken),
      user: {
        ...user,
        id: user.id || principal.sub,
        roles: principal.roles.length ? principal.roles : user.roles,
        permissions: principal.permissions.length
          ? principal.permissions
          : user.permissions,
      },
    };
    if (
      !auth.user.roles.some(
        (role) => role === "admin" || role === "super_admin",
      )
    )
      throw new ApiError("Administrator access is required", 403);
    persistAuth(auth);
    return auth;
  },

  async logout(): Promise<void> {
    const auth = readAuth();
    if (auth) {
      await request("/api/auth/logout", { method: "POST" }).catch(
        () => undefined,
      );
    }
    persistAuth(null);
  },

  async requestForgotPassword(email: string): Promise<string> {
    const response = await request<unknown>("/user/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return stringValue(object(object(response).data).key);
  },

  async completeForgotPassword(
    key: string,
    otp: string,
    password: string,
  ): Promise<void> {
    await request("/user/forgot-password", {
      method: "PUT",
      body: JSON.stringify({ key, otp, password }),
    });
  },

  async completeAdminReset(key: string, password: string): Promise<void> {
    await request("/user/admin-reset-password-verify", {
      method: "PUT",
      body: JSON.stringify({ key, password }),
    });
  },

  async projects(): Promise<ProjectRecord[]> {
    const response = await request<unknown>(
      "/admin/getprojects?expand=programs",
    );
    return array(object(response).data).map(project);
  },

  async project(id: string): Promise<ProjectRecord> {
    const response = await request<unknown>(
      `/admin/getprojects/${encodeURIComponent(id)}?expand=programs`,
    );
    const rows = array(object(response).data).map(project);
    if (!rows[0]) throw new ApiError("Project not found", 404);
    return rows[0];
  },

  async program(id: string): Promise<ProgramRecord> {
    const response = await request<unknown>(
      `/admin/getProgramById/${encodeURIComponent(id)}`,
    );
    const data = object(object(response).data);
    return program({ ...object(data.program), ...data });
  },

  async organizations(programId?: string): Promise<OrganizationRecord[]> {
    const query = programId
      ? `?programId=${encodeURIComponent(programId)}`
      : "";
    const response = await request<unknown>(`/admin/getOrganizations${query}`);
    return array(object(response).data).map(organization);
  },

  async eligibleImpersonationUsers(
    organizationId: string,
    programId: string,
  ): Promise<PortalUserRecord[]> {
    const query = new URLSearchParams({ organizationId, programId });
    const response = await request<{ users: PortalUserRecord[] }>(
      `/admin/impersonations/eligible-users?${query.toString()}`,
    );
    return response.users;
  },

  async users(): Promise<UserRecord[]> {
    const response = await request<unknown>("/user/list?expand=projects");
    return array(object(response).data).map((entry) => {
      const value = object(entry);
      const organizationValue = object(value.organization);
      return {
        id: stringValue(value.id) || stringValue(value._id),
        fullName: stringValue(value.fullName) || stringValue(value.name),
        email: stringValue(value.email),
        username: stringValue(value.username) || null,
        role: stringValue(value.role) || null,
        roleId: stringValue(value.roleId) || null,
        organization: stringValue(organizationValue.id)
          ? {
              id: stringValue(organizationValue.id),
              name: stringValue(organizationValue.name),
            }
          : null,
        projects: array(value.projects).map((projectValue) => {
          const project = object(projectValue);
          return {
            id: stringValue(project.id) || stringValue(project._id),
            name: stringValue(project.name) || stringValue(project.Name),
          };
        }),
        createdAt:
          stringValue(value.createdAt) || stringValue(value.createAt) || null,
        lastLogin: stringValue(value.lastLogin) || null,
        status: stringValue(value.status),
      };
    });
  },

  async roles(): Promise<Record<string, unknown>[]> {
    const response = await request<unknown>("/admin/getroles");
    return array(object(response).roleData ?? object(response).data).map(
      object,
    );
  },

  async createRole(roleName: string, permissions: string[]): Promise<void> {
    await request("/admin/addrole", {
      method: "POST",
      body: JSON.stringify({ roleName, permissions }),
    });
  },

  async createUser(input: {
    fullName: string;
    email: string;
    username: string;
    mobile?: string;
    roleId: string;
    projects: string[];
    organizationId?: string;
    programs?: string[];
  }): Promise<void> {
    await request("/user/create", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateUser(
    userId: string,
    input: {
      fullName: string;
      email: string;
      username: string;
      roleId?: string;
      projects?: string[];
    },
  ): Promise<void> {
    await request(`/user/update/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  async deleteUser(userId: string): Promise<void> {
    await request(`/user/delete/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  async resetUserPassword(userId: string): Promise<{
    username: string;
    email: string;
    temporaryPassword: string;
  }> {
    const response = await request<unknown>(
      "/user/admin-generate-temp-password",
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
    );
    const data = object(object(response).data);
    return {
      username: stringValue(data.username),
      email: stringValue(data.email),
      temporaryPassword: stringValue(data.temporaryPassword),
    };
  },

  async orders(): Promise<Record<string, unknown>[]> {
    const response = await request<unknown>(
      "/admin/order/log?page=1&per_page=100&sortBy=createdAt",
    );
    return array(object(response).data).map(object);
  },

  async activity(): Promise<Record<string, unknown>[]> {
    const response = await request<unknown>(
      "/admin/system/log?page=1&limit=100",
    );
    return array(object(response).data).map(object);
  },

  async sessions(): Promise<Record<string, unknown>[]> {
    const response = await request<unknown>(
      "/admin/loginSession/log?page=1&limit=100",
    );
    return array(object(response).data).map(object);
  },

  async resyncProgram(programId: string): Promise<void> {
    await request("/webhook/massResyncByProgram", {
      method: "POST",
      body: JSON.stringify({ programId }),
    });
  },

  async zohoPrograms(): Promise<ZohoProgramOption[]> {
    const response = await request<unknown>("/zoho/programs");
    return array(object(response).data).map((entry) => {
      const value = object(entry);
      const parsedYear = Number(value.year);
      return {
        id: stringValue(value.id),
        name: stringValue(value.name),
        year: Number.isInteger(parsedYear) ? parsedYear : null,
        efsLaunchDate: stringValue(value.efsLaunchDate) || null,
        efsDeadline: stringValue(value.efsDeadline) || null,
      };
    });
  },

  async startImpersonation(
    organizationId: string,
    programId: string,
    targetUserId?: string,
  ): Promise<{ url: string }> {
    return request<{ url: string }>("/admin/impersonations", {
      method: "POST",
      body: JSON.stringify({
        organizationId,
        programId,
        ...(targetUserId ? { targetUserId } : {}),
        reason: "Preview client dashboard from administration",
      }),
    });
  },

  async reportProductTemplates(): Promise<ReportProduct[]> {
    const response = await request<unknown>("/admin/report-product-templates");
    return array(object(response).data) as ReportProduct[];
  },

  async programCatalog(programId: string): Promise<ReportProduct[]> {
    const response = await request<unknown>(
      `/admin/programs/${encodeURIComponent(programId)}/report-catalog`,
    );
    return array(object(response).data) as ReportProduct[];
  },

  async saveProgramCatalog(
    programId: string,
    products: ReportProduct[],
  ): Promise<ReportProduct[]> {
    const response = await request<unknown>(
      `/admin/programs/${encodeURIComponent(programId)}/report-catalog`,
      {
        method: "PUT",
        body: JSON.stringify({ products }),
      },
    );
    return array(object(response).data) as ReportProduct[];
  },

  async organizationCatalog(
    organizationProgramId: string,
  ): Promise<OrganizationCatalog> {
    const response = await request<unknown>(
      `/admin/organization-programs/${encodeURIComponent(organizationProgramId)}/report-catalog`,
    );
    return object(object(response).data) as OrganizationCatalog;
  },

  async saveOrganizationCatalog(
    organizationProgramId: string,
    products: ReportProduct[],
    inherit: boolean,
  ): Promise<OrganizationCatalog> {
    const response = await request<unknown>(
      `/admin/organization-programs/${encodeURIComponent(organizationProgramId)}/report-catalog`,
      {
        method: "PUT",
        body: JSON.stringify(inherit ? { inherit: true } : { products }),
      },
    );
    return object(object(response).data) as OrganizationCatalog;
  },

  async createHistoricalImport(
    metadata: HistoricalImportMetadata,
  ): Promise<{ importId: string; metadata: HistoricalImportMetadata }> {
    const response = await request<unknown>("/admin/historicalImports", {
      method: "POST",
      body: JSON.stringify(metadata),
    });
    return object(object(response).data) as {
      importId: string;
      metadata: HistoricalImportMetadata;
    };
  },

  async updateHistoricalImportMetadata(
    importId: string,
    metadata: HistoricalImportMetadata,
  ): Promise<{ importId: string; metadata: HistoricalImportMetadata }> {
    const response = await request<unknown>(
      `/admin/historicalImports/${encodeURIComponent(importId)}/metadata`,
      {
        method: "PUT",
        body: JSON.stringify(metadata),
      },
    );
    return object(object(response).data) as {
      importId: string;
      metadata: HistoricalImportMetadata;
    };
  },

  async uploadHistoricalImportWorkbooks(
    importId: string,
    eaFile: File,
    efsFile: File,
  ): Promise<{ importId: string; eaFileName: string; efsFileName: string }> {
    const auth = readAuth();
    const formData = new FormData();
    formData.append("eaFile", eaFile);
    formData.append("efsFile", efsFile);
    const response = await fetch(
      `${apiBaseUrl}/admin/historicalImports/${encodeURIComponent(importId)}/workbooks`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...authHeaders(auth?.accessToken),
        },
        body: formData,
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && auth?.accessToken) persistAuth(null);
      const body = object(payload);
      const nested = object(body.error);
      throw new ApiError(
        stringValue(body.message) ||
          stringValue(body.msg) ||
          stringValue(nested.message) ||
          "Request failed",
        response.status,
      );
    }
    return object(object(payload).data) as {
      importId: string;
      eaFileName: string;
      efsFileName: string;
    };
  },

  async uploadBenefitsBestPracticesWorkbook(
    organizationProgramId: string,
    file: File,
  ): Promise<{
    organizationId: string;
    organizationProgramId: string;
    programId: string;
    sourceFile: string;
    headerCount: number;
    sectionCount: number;
    uploadedAt: string;
  }> {
    const auth = readAuth();
    const formData = new FormData();
    formData.append("workbook", file);
    const response = await fetch(
      `${apiBaseUrl}/admin/organization-programs/${encodeURIComponent(organizationProgramId)}/benefits-best-practices`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...authHeaders(auth?.accessToken),
        },
        body: formData,
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && auth?.accessToken) persistAuth(null);
      const body = object(payload);
      const nested = object(body.error);
      throw new ApiError(
        stringValue(body.message) ||
          stringValue(body.msg) ||
          stringValue(nested.message) ||
          "Request failed",
        response.status,
      );
    }
    return object(object(payload).data) as {
      organizationId: string;
      organizationProgramId: string;
      programId: string;
      sourceFile: string;
      headerCount: number;
      sectionCount: number;
      uploadedAt: string;
    };
  },

  async validateHistoricalImport(
    importId: string,
  ): Promise<HistoricalImportValidationSummary> {
    const response = await request<unknown>(
      `/admin/historicalImports/${encodeURIComponent(importId)}/validate`,
      { method: "POST" },
    );
    return object(object(response).data) as HistoricalImportValidationSummary;
  },

  async commitHistoricalImport(
    importId: string,
  ): Promise<HistoricalImportStatus> {
    const response = await request<unknown>(
      `/admin/historicalImports/${encodeURIComponent(importId)}/commit`,
      { method: "POST" },
    );
    return object(object(response).data) as HistoricalImportStatus;
  },

  async historicalImportStatus(
    importId: string,
  ): Promise<HistoricalImportStatus> {
    const response = await request<unknown>(
      `/admin/historicalImports/${encodeURIComponent(importId)}`,
    );
    return object(object(response).data) as HistoricalImportStatus;
  },
};

export const formatDate = (value: unknown): string => {
  const date =
    typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US")
    : "—";
};

export const formatDateTime = (value: unknown): string => {
  const date =
    typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
};

export const field = (
  row: Record<string, unknown>,
  ...keys: string[]
): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number")
      return String(value);
  }
  return "—";
};
