import { z, type ZodType } from "zod";
import {
  adminUserSchema,
  annualCategoriesSchema,
  annualDetailsSchema,
  annualResponseRateSchema,
  comparisonQuestionsSchema,
  demographicResponseSchema,
  employeeResponseBreakdownSchema,
  employeeResponseBreakdownBySectionSchema,
  loginResultSchema,
  projectSchema,
  reportProductSchema,
  roleSchema,
  sessionSchema,
  syncJobSchema,
  workforceComparisonSchema,
  type LoginResult,
  type Session,
} from "./schemas";
import {
  adminSession,
  adminUsers,
  clientSession,
  products,
  projects,
  roles,
  syncJobs,
} from "../fixtures/data";

const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/v1",
  fixturesEnabled: import.meta.env.VITE_USE_API_FIXTURES !== "false",
};

const fixtureSessionStorageKey = "wrg-platform-fixture-session";

function readFixtureSession(): Session | null {
  try {
    const stored = window.localStorage.getItem(fixtureSessionStorageKey);
    if (!stored) return null;

    const parsed = sessionSchema.safeParse(JSON.parse(stored));
    if (
      !parsed.success ||
      new Date(parsed.data.expiresAt).getTime() <= Date.now()
    ) {
      window.localStorage.removeItem(fixtureSessionStorageKey);
      return null;
    }
    return parsed.data;
  } catch {
    window.localStorage.removeItem(fixtureSessionStorageKey);
    return null;
  }
}

function persistFixtureSession(session: Session): void {
  window.localStorage.setItem(
    fixtureSessionStorageKey,
    JSON.stringify(session),
  );
}

function clearFixtureSession(): void {
  window.localStorage.removeItem(fixtureSessionStorageKey);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema: ZodType<T>;
  signal?: AbortSignal;
};

async function request<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({
        message: z.string().optional(),
        code: z.string().optional(),
        requestId: z.string().optional(),
      })
      .safeParse(payload);
    throw new ApiError(
      parsed.success
        ? (parsed.data.message ?? "Request failed")
        : "Request failed",
      response.status,
      parsed.success
        ? (parsed.data.code ?? "request_failed")
        : "request_failed",
      parsed.success ? parsed.data.requestId : undefined,
    );
  }
  return options.schema.parse(payload);
}

async function downloadRequest(
  path: string,
  filename: string,
  method: "GET" | "POST" = "GET",
): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  if (!response.ok) throw new ApiError("Report download failed", response.status, "report_download_failed");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pause = async () =>
  new Promise<void>((resolve) => window.setTimeout(resolve, 120));

async function fixture<T>(value: T): Promise<T> {
  await pause();
  return structuredClone(value);
}

async function responseCountByDemographic(programId: string) {
  const response = await request(
    `/client/responseCountByDemographicCategory?selectedProgramId=${encodeURIComponent(programId)}`,
    {
      schema: demographicResponseSchema,
    },
  );

  return response.data.map((item) => ({
    category: item.categoryLabel,
    group: item.category.toLowerCase().startsWith("personal")
      ? ("personal" as const)
      : ("workplace" as const),
    values: item.options.map((option) => ({
      label: option.Caption,
      count: option.Count,
    })),
  }));
}

function fixtureSession(kind: "client" | "admin"): LoginResult {
  return {
    status: "authenticated",
    session: kind === "client" ? clientSession : adminSession,
  };
}

async function fixtureLogin(kind: "client" | "admin"): Promise<LoginResult> {
  const result = await fixture(fixtureSession(kind));
  if (result.status === "authenticated") persistFixtureSession(result.session);
  return result;
}

export const api = {
  session: {
    get: (): Promise<Session | null> =>
      env.fixturesEnabled
        ? Promise.resolve(readFixtureSession())
        : request("/session", { schema: sessionSchema.nullable() }),
    logout: (): Promise<void> =>
      env.fixturesEnabled
        ? Promise.resolve(clearFixtureSession())
        : request("/session", { method: "DELETE", schema: z.void() }),
    stopImpersonation: (): Promise<Session> =>
      request("/session/impersonation", {
        method: "DELETE",
        schema: sessionSchema,
      }),
  },
  auth: {
    clientLogin: (input: {
      username: string;
      email: string;
    }): Promise<LoginResult> =>
      env.fixturesEnabled
        ? fixtureLogin("client")
        : request("/auth/client/login", {
            method: "POST",
            body: input,
            schema: loginResultSchema,
          }),
    adminLogin: (input: {
      email: string;
      password: string;
    }): Promise<LoginResult> =>
      env.fixturesEnabled
        ? fixture({
            status: "challenge_required" as const,
            challengeId: `fixture-admin-${input.email}`,
            methods: ["email" as const],
          })
        : request("/auth/admin/login", {
            method: "POST",
            body: input,
            schema: loginResultSchema,
          }),
    verifyChallenge: (input: {
      challengeId: string;
      code: string;
    }): Promise<Session> =>
      env.fixturesEnabled
        ? input.code.trim().length === 6
          ? fixture(adminSession).then((session) => {
              persistFixtureSession(session);
              return session;
            })
          : Promise.reject(
              new ApiError(
                "Invalid verification code",
                400,
                "invalid_challenge",
              ),
            )
        : request("/auth/challenges/verify", {
            method: "POST",
            body: input,
            schema: sessionSchema,
          }),
    requestRecovery: (input: { email: string }): Promise<{ accepted: true }> =>
      env.fixturesEnabled
        ? fixture({ accepted: true as const })
        : request("/auth/recovery", {
            method: "POST",
            body: input,
            schema: z.object({ accepted: z.literal(true) }),
          }),
  },
  reports: {
    demographics: (programId: string) => responseCountByDemographic(programId),
    catalog: () =>
      env.fixturesEnabled
        ? fixture(products)
        : request("/reports/catalog", { schema: z.array(reportProductSchema) }),
    responseBreakdownBySection: (programId: string) =>
      request(
        `/client/employeeResponseBreakdownBySection?selectedProgramId=${encodeURIComponent(programId)}&fullReport=false`,
        {
          method: "POST",
          body: {},
          schema: employeeResponseBreakdownBySectionSchema,
        },
      ),
    responseBreakdown: (programId: string, questionRange: string[]) =>
      request(
        `/client/employeeResponseBreakdown?selectedProgramId=${encodeURIComponent(programId)}&fullReport=false`,
        {
          method: "POST",
          body: { questionRange },
          schema: employeeResponseBreakdownSchema,
        },
      ),
    workforceComparison: (programId: string) =>
      request(
        `/client/v2/employeeComparisonReport?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: workforceComparisonSchema },
      ),
    comparisonQuestions: (
      programId: string,
      category: string,
      selectedCategoryOption: string,
    ) =>
      request(
        `/client/employeeSectionQuestionsComparisonWithMeReport?selectedProgramId=${encodeURIComponent(programId)}`,
        {
          method: "POST",
          body: { category, selectedCategoryOption },
          schema: comparisonQuestionsSchema,
        },
      ),
    annualResponseRate: (programId: string) =>
      request(
        `/client/surveyResponseRateAnuualTrend?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: annualResponseRateSchema },
      ),
    annualCategories: (programId: string) =>
      request(
        `/client/employeeAnnualTrendsCategory?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: annualCategoriesSchema },
      ),
    annualDetails: (
      programId: string,
      category: string,
      currentQuestionIds: string[],
      previousQuestionIds: string[],
    ) =>
      request(
        `/client/employeeAnnualTrendsDetail?selectedProgramId=${encodeURIComponent(programId)}`,
        {
          method: "POST",
          body: {
            category,
            curruntYear: currentQuestionIds,
            prevYear: previousQuestionIds,
          },
          schema: annualDetailsSchema,
        },
      ),
    downloadDetailedWorkbook: (programId: string) =>
      downloadRequest(
        `/client/generateHeatMapDetailed?selectedProgramId=${encodeURIComponent(programId)}`,
        "Employee_Feedback_Detailed.xlsx",
      ),
    downloadResponsePatternsWorkbook: (
      programId: string,
      responsePatterns: { metric: "agreement" | "disagreement"; minimum: number; maximum: number }[],
    ) =>
      downloadRequest(
        `/client/generateHeatMap?selectedProgramId=${encodeURIComponent(programId)}&queryFilter=${encodeURIComponent(JSON.stringify({ responsePatterns }))}`,
        "Response_Patterns.xlsx",
      ),
    downloadAnnualWorkbook: (programId: string) =>
      downloadRequest(
        `/client/annualTrensReportDownload?selectedProgramId=${encodeURIComponent(programId)}`,
        "Annual_Trends_Report.xlsx",
        "POST",
      ),
    downloadVerbatimsWorkbook: (programId: string) =>
      downloadRequest(
        `/client/getOpenResponsesAnswersReport?selectedProgramId=${encodeURIComponent(programId)}`,
        "Employee_Verbatims_Report.xlsx",
        "POST",
      ),
    downloadBenchmarkWorkbook: (programId: string) =>
      downloadRequest(
        `/client/v2/generateBenchmarkReport?selectedProgramId=${encodeURIComponent(programId)}`,
        "Workforce_Benchmark_Report.xlsx",
      ),
    downloadBenefitsWorkbook: (programId: string) =>
      downloadRequest(
        `/client/employerBenchmarkReportExcel?selectedProgramId=${encodeURIComponent(programId)}`,
        "Benefits_&_Best_Practices.xlsx",
      ),
    downloadResponseDetailWorkbook: (programId: string) =>
      downloadRequest(
        `/client/responseDetailReportExcel?selectedProgramId=${encodeURIComponent(programId)}`,
        "Response_Detail_Report.xlsx",
      ),
  },
  admin: {
    projects: () =>
      env.fixturesEnabled
        ? fixture(projects)
        : request("/admin/projects", { schema: z.array(projectSchema) }),
    users: () =>
      env.fixturesEnabled
        ? fixture(adminUsers)
        : request("/admin/users", { schema: z.array(adminUserSchema) }),
    roles: () =>
      env.fixturesEnabled
        ? fixture(roles)
        : request("/admin/roles", { schema: z.array(roleSchema) }),
    syncJobs: () =>
      env.fixturesEnabled
        ? fixture(syncJobs)
        : request("/admin/sync-jobs", { schema: z.array(syncJobSchema) }),
  },
};
