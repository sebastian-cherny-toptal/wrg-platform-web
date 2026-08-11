import { z, type ZodType } from "zod";
import {
  annualCategoriesSchema,
  annualDetailsSchema,
  annualResponseRateSchema,
  comparisonQuestionsSchema,
  demographicResponseSchema,
  employeeResponseBreakdownSchema,
  employeeResponseBreakdownBySectionSchema,
  heatMapPreviewResponseSchema,
  loginResultSchema,
  reportProductSchema,
  sessionSchema,
  surveyFiltersResponseSchema,
  workforceComparisonSchema,
  type LoginResult,
  type Session,
} from "./schemas";
import { clientSession, products } from "../fixtures/data";

export type ResponsePatternRanges = {
  positive?: [number, number];
  neutral?: [number, number];
  negative?: [number, number];
};

export type ReportQueryFilter = Record<string, string[]>;

export type SurveyFilter = {
  questionId: string;
  label: string;
  options: { label: string; values: string[] }[];
};

const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/v1",
  apiV1BaseUrl: import.meta.env.VITE_API_V1_BASE_URL ?? "/api",
  fixturesEnabled: import.meta.env.VITE_USE_API_FIXTURES !== "false",
};

const fixtureSessionStorageKey = "wrg-platform-fixture-session";
const impersonationTokenStorageKey = "wrg-impersonation-token";
const impersonationSessionStorageKey = "wrg-impersonation-session";
const impersonationExchanges = new Map<string, Promise<Session>>();

function impersonationToken(): string | null {
  return window.sessionStorage.getItem(impersonationTokenStorageKey);
}

function readImpersonationSession(): Session | null {
  try {
    const stored = window.sessionStorage.getItem(
      impersonationSessionStorageKey,
    );
    if (!stored) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(stored));
    if (
      !parsed.success ||
      new Date(parsed.data.expiresAt).getTime() <= Date.now()
    ) {
      clearImpersonationSession();
      return null;
    }
    return parsed.data;
  } catch {
    clearImpersonationSession();
    return null;
  }
}

function clearImpersonationSession(): void {
  window.sessionStorage.removeItem(impersonationTokenStorageKey);
  window.sessionStorage.removeItem(impersonationSessionStorageKey);
}

function exchangeImpersonation(grant: string): Promise<Session> {
  const existing = impersonationExchanges.get(grant);
  if (existing) return existing;

  const exchange = (async () => {
    const response = await fetch(
      `${env.apiV1BaseUrl}/auth/impersonations/exchange`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grant }),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        "Dashboard preview could not be started",
        response.status,
        "invalid_impersonation_grant",
      );
    const parsed = z
      .object({ accessToken: z.string(), session: sessionSchema })
      .parse(payload);
    window.sessionStorage.setItem(
      impersonationTokenStorageKey,
      parsed.accessToken,
    );
    window.sessionStorage.setItem(
      impersonationSessionStorageKey,
      JSON.stringify(parsed.session),
    );
    return parsed.session;
  })();

  impersonationExchanges.set(grant, exchange);
  void exchange.then(
    () => impersonationExchanges.delete(grant),
    () => impersonationExchanges.delete(grant),
  );
  return exchange;
}

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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(impersonationToken()
        ? { Authorization: `Bearer ${impersonationToken()}` }
        : {}),
    },
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
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(impersonationToken()
        ? { Authorization: `Bearer ${impersonationToken()}` }
        : {}),
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  if (!response.ok)
    throw new ApiError(
      "Report download failed",
      response.status,
      "report_download_failed",
    );
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function responsePatternsPath(
  programId: string,
  ranges: ResponsePatternRanges,
  isPreview = false,
): string {
  const params = new URLSearchParams({
    selectedProgramId: programId,
    patternMode: "range",
    includePositive: String(Boolean(ranges.positive)),
    includeNeutral: String(Boolean(ranges.neutral)),
    includeNegative: String(Boolean(ranges.negative)),
  });
  const rangeParams = [
    ["positive", ranges.positive],
    ["neutral", ranges.neutral],
    ["negative", ranges.negative],
  ] as const;
  for (const [name, range] of rangeParams) {
    if (!range) continue;
    params.set(`${name}Min`, String(range[0]));
    params.set(`${name}Max`, String(range[1]));
  }
  if (isPreview) params.set("isPreview", "true");
  return `/client/generateHeatMap?${params.toString()}`;
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

async function surveyFilters(programId: string): Promise<SurveyFilter[]> {
  const response = await request(
    `/client/fetchSurveyFilter?selectedProgramId=${encodeURIComponent(programId)}`,
    { schema: surveyFiltersResponseSchema },
  );

  return response.data.map((filter) => ({
    questionId: String(filter.QuestionId),
    label: filter.filterLabel,
    options: Array.isArray(filter.filterOption)
      ? filter.filterOption.map((option) => ({
          label: option.Caption,
          values: [option.Caption],
        }))
      : Object.entries(filter.filterOption).map(([label, values]) => ({
          label,
          values,
        })),
  }));
}

function fixtureSession(): LoginResult {
  return {
    status: "authenticated",
    session: clientSession,
  };
}

async function fixtureLogin(): Promise<LoginResult> {
  const result = await fixture(fixtureSession());
  if (result.status === "authenticated") persistFixtureSession(result.session);
  return result;
}

export const api = {
  session: {
    get: (): Promise<Session | null> => {
      if (window.location.pathname === "/admin-preview") {
        clearImpersonationSession();
        return Promise.resolve(null);
      }
      const previewSession = readImpersonationSession();
      return previewSession
        ? Promise.resolve(previewSession)
        : env.fixturesEnabled
          ? Promise.resolve(readFixtureSession())
          : request("/session", { schema: sessionSchema.nullable() });
    },
    logout: (): Promise<void> =>
      impersonationToken()
        ? Promise.resolve(clearImpersonationSession())
        : env.fixturesEnabled
          ? Promise.resolve(clearFixtureSession())
          : request("/session", { method: "DELETE", schema: z.void() }),
    stopImpersonation: async (): Promise<void> => {
      const token = impersonationToken();
      if (token) {
        await fetch(`${env.apiV1BaseUrl}/auth/impersonations/current`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => undefined);
      }
      clearImpersonationSession();
    },
  },
  auth: {
    exchangeImpersonation,
    clientLogin: (input: {
      username: string;
      email: string;
    }): Promise<LoginResult> =>
      env.fixturesEnabled
        ? fixtureLogin()
        : request("/auth/client/login", {
            method: "POST",
            body: input,
            schema: loginResultSchema,
          }),
  },
  reports: {
    demographics: (programId: string) => responseCountByDemographic(programId),
    surveyFilters,
    catalog: () =>
      env.fixturesEnabled
        ? fixture(products)
        : request("/reports/catalog", { schema: z.array(reportProductSchema) }),
    responseBreakdownBySection: (
      programId: string,
      queryFilter: ReportQueryFilter = {},
    ) =>
      request(
        `/client/employeeResponseBreakdownBySection?selectedProgramId=${encodeURIComponent(programId)}&fullReport=false`,
        {
          method: "POST",
          body: { queryFilter },
          schema: employeeResponseBreakdownBySectionSchema,
        },
      ),
    responseBreakdown: (
      programId: string,
      questionRange: string[],
      queryFilter: ReportQueryFilter = {},
    ) =>
      request(
        `/client/employeeResponseBreakdown?selectedProgramId=${encodeURIComponent(programId)}&fullReport=false`,
        {
          method: "POST",
          body: { questionRange, queryFilter },
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
    downloadDetailedWorkbook: (
      programId: string,
      queryFilter: ReportQueryFilter = {},
    ) =>
      downloadRequest(
        `/client/generateHeatMap?selectedProgramId=${encodeURIComponent(programId)}${
          Object.keys(queryFilter).length
            ? `&queryFilter=${encodeURIComponent(JSON.stringify(queryFilter))}`
            : ""
        }`,
        "Workforce_Feedback_Results.xlsx",
        "POST",
      ),
    downloadFeedbackWorkbook: (programId: string) =>
      downloadRequest(
        `/client/generateHeatMap?selectedProgramId=${encodeURIComponent(programId)}`,
        "Workforce_Feedback_Results.xlsx",
        "POST",
      ),
    previewResponsePatterns: (
      programId: string,
      ranges: ResponsePatternRanges,
    ) =>
      request(responsePatternsPath(programId, ranges, true), {
        schema: heatMapPreviewResponseSchema,
      }),
    downloadResponsePatternsWorkbook: (
      programId: string,
      ranges: ResponsePatternRanges,
    ) =>
      downloadRequest(
        responsePatternsPath(programId, ranges),
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
};
