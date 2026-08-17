import { z, type ZodType } from "zod";
import {
  annualCategoriesSchema,
  annualDetailsSchema,
  annualResponseRateSchema,
  comparisonQuestionsSchema,
  customReportsSchema,
  demographicResponseSchema,
  dashboardAgreementSchema,
  dashboardResponseRateSchema,
  dashboardStatementsSchema,
  employeeResponseBreakdownSchema,
  employeeResponseBreakdownBySectionSchema,
  heatMapPreviewResponseSchema,
  keyImpactAnalysisSchema,
  legacyClientLoginSchema,
  openResponseAnswersSchema,
  openResponseQuestionsSchema,
  employerBenchmarkSchema,
  reportProductSchema,
  paymentIntentSchema,
  responseDetailResultSchema,
  responseDetailSectionsSchema,
  sessionSchema,
  surveyFiltersResponseSchema,
  workforceComparisonSchema,
  type LoginResult,
  type Session,
} from "./schemas";
import { useAppStore } from "../store/app-store";

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
  compatibilityApiBaseUrl:
    import.meta.env.VITE_COMPATIBILITY_API_BASE_URL ?? "",
};

const impersonationTokenStorageKey = "wrg-impersonation-token";
const impersonationSessionStorageKey = "wrg-impersonation-session";
const clientTokenStorageKey = "wrg-client-access-token";
const clientSessionStorageKey = "wrg-client-session";
const impersonationExchanges = new Map<string, Promise<Session>>();

function impersonationToken(): string | null {
  return window.sessionStorage.getItem(impersonationTokenStorageKey);
}

function clientToken(): string | null {
  return window.localStorage.getItem(clientTokenStorageKey);
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

function clearClientSession(): void {
  window.localStorage.removeItem(clientTokenStorageKey);
  window.localStorage.removeItem(clientSessionStorageKey);
}

function closeUnauthorizedSession(): void {
  clearImpersonationSession();
  clearClientSession();
  useAppStore.getState().setSession(null);
}

function readClientSession(): Session | null {
  try {
    const stored = window.localStorage.getItem(clientSessionStorageKey);
    const token = clientToken();
    if (!stored || !token) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(stored));
    if (!parsed.success || new Date(parsed.data.expiresAt).getTime() <= Date.now()) {
      clearClientSession();
      return null;
    }
    return parsed.data;
  } catch {
    clearClientSession();
    return null;
  }
}

function tokenExpiration(token: string): string {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) throw new Error("JWT payload is missing");
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(window.atob(normalized)) as { exp?: unknown };
    if (typeof payload.exp !== "number") throw new Error("JWT expiration is missing");
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
}

function entitlement(value: unknown): "yes" | "no" {
  return typeof value === "string" && value.trim().toLowerCase() === "yes"
    ? "yes"
    : "no";
}

async function backendClientLogin(input: {
  username: string;
  email: string;
}): Promise<LoginResult> {
  const response = await request("/user/login", {
    method: "POST",
    body: { username: input.username, userEmail: input.email },
    schema: legacyClientLoginSchema,
  });
  const { accessToken, userData } = response.data;
  const organizationName =
    userData.organizationId.Account_Name ??
    userData.organizationId.name ??
    userData.fullName;
  const programs = userData.organizationProgram.map((enrollment) => {
    const reference = enrollment.programId;
    const id = reference.id ?? reference._id;
    const name = reference.name ?? reference.Name;
    const year = reference.year ?? Number(reference.Program_Year);
    if (!id || !name || !Number.isInteger(year)) {
      throw new ApiError(
        "The account contains an invalid reporting program",
        502,
        "invalid_program",
      );
    }
    return {
      id,
      name,
      year,
      organizationName,
      entitlements: {
        WFR_Access: entitlement(enrollment.reportAccess.WFR_Access),
        EV_Access: entitlement(enrollment.reportAccess.EV_Access),
        WBC_Access: entitlement(enrollment.reportAccess.WBC_Access),
        BBP_Access: entitlement(enrollment.reportAccess.BBP_Access),
        RD_Access: entitlement(enrollment.reportAccess.RD_Access),
        KIA_Access: entitlement(enrollment.reportAccess.KIA_Access),
        CR_Access: entitlement(enrollment.reportAccess.CR_Access),
      },
    };
  });
  const session = sessionSchema.parse({
    user: {
      id: userData.id ?? userData._id,
      displayName: userData.fullName,
      email: userData.email,
      role: "client",
      permissions: [],
      programs,
    },
    expiresAt: tokenExpiration(accessToken),
    verifiedAt: new Date().toISOString(),
    impersonation: null,
  });
  window.localStorage.setItem(clientTokenStorageKey, accessToken);
  window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
  return { status: "authenticated", session };
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
  const baseUrl = path.startsWith("/client/") || path.startsWith("/user/") || path.startsWith("/payment/")
    ? env.compatibilityApiBaseUrl
    : env.apiBaseUrl;
  const accessToken = impersonationToken() ?? clientToken();
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && accessToken) closeUnauthorizedSession();
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
  const accessToken = impersonationToken() ?? clientToken();
  const response = await fetch(`${env.compatibilityApiBaseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  if (!response.ok) {
    if (response.status === 401 && accessToken) closeUnauthorizedSession();
    throw new ApiError(
      "Report download failed",
      response.status,
      "report_download_failed",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadUrl(url: string, filename: string): Promise<void> {
  const resolved = new URL(url, window.location.origin);
  const accessToken =
    resolved.origin === window.location.origin
      ? impersonationToken() ?? clientToken()
      : null;
  const response = await fetch(resolved, {
    credentials: "include",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401 && accessToken) closeUnauthorizedSession();
    throw new ApiError(
      "Report download failed",
      response.status,
      "report_download_failed",
    );
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
    values: [...item.options]
      .sort((left, right) => left.Position - right.Position)
      .map((option) => ({
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
        : Promise.resolve(readClientSession());
    },
    logout: async (): Promise<void> => {
      if (impersonationToken()) {
        clearImpersonationSession();
        return;
      }
      try {
        if (clientToken()) {
          await request("/auth/logout", {
            method: "POST",
            schema: z.object({ ok: z.literal(true) }),
          });
        }
      } finally {
        clearClientSession();
      }
    },
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
    }): Promise<LoginResult> => backendClientLogin(input),
  },
  dashboard: {
    overview: async (programId: string) => {
      const selectedProgramId = encodeURIComponent(programId);
      const [agreement, responseRate, statements] = await Promise.all([
        request(
          `/client/averagePercentageOfAgreement?selectedProgramId=${selectedProgramId}`,
          { schema: dashboardAgreementSchema },
        ),
        request(
          `/client/surveyResponseRate?selectedProgramId=${selectedProgramId}`,
          { schema: dashboardResponseRateSchema },
        ),
        request(
          `/client/dashboardTopBottomStatements?selectedProgramId=${selectedProgramId}`,
          { schema: dashboardStatementsSchema },
        ),
      ]);
      return {
        agreement: agreement.data,
        responseRate: responseRate.data,
        statements: statements.data,
      };
    },
  },
  reports: {
    demographics: (programId: string) => responseCountByDemographic(programId),
    surveyFilters,
    catalog: (programId?: string) =>
      request(`/reports/catalog${programId ? `?programId=${encodeURIComponent(programId)}` : ""}`, { schema: z.array(reportProductSchema) }),
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
    openResponseQuestions: (programId: string) =>
      request(
        `/client/getOpenResponsesQuestions?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: openResponseQuestionsSchema },
      ),
    openResponseAnswers: (
      programId: string,
      questionId: string,
      queryFilter: ReportQueryFilter = {},
    ) =>
      request(
        `/client/getOpenResponsesAnswers?selectedProgramId=${encodeURIComponent(programId)}&questionId=${encodeURIComponent(questionId)}`,
        {
          method: "POST",
          body: { queryFilter },
          schema: openResponseAnswersSchema,
        },
      ),
    employerBenchmark: (programId: string) =>
      request(
        `/client/employerBenchmarkReport?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: employerBenchmarkSchema },
      ),
    responseDetailSections: (programId: string) =>
      request(
        `/client/responseDetailReportSectionQuestions?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: responseDetailSectionsSchema },
      ),
    responseDetailResult: (
      programId: string,
      questionId: string,
      filterQuestion: string,
    ) =>
      request(
        `/client/responseDetailReportQuestionResult?selectedProgramId=${encodeURIComponent(programId)}&version=1`,
        {
          method: "POST",
          body: { QuestionId: questionId, filterQuestion },
          schema: responseDetailResultSchema,
        },
      ),
    customReports: (programId: string) =>
      request(
        `/client/getCustomReport?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: customReportsSchema },
      ),
    keyImpactAnalysis: (programId: string) =>
      request(
        `/client/getKeyImpactAnalysis?selectedProgramId=${encodeURIComponent(programId)}`,
        { schema: keyImpactAnalysisSchema },
      ),
    downloadCustomReport: (url: string, filename: string) =>
      downloadUrl(url, filename),
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
  commerce: {
    createPaymentIntent: (input: {
      programId: string;
      amount: number;
      currency: string;
      items: { title: string; amount: number; keys: Record<string, unknown> }[];
    }) => request(`/payment/stripePaymentIntent?selectedProgramId=${encodeURIComponent(input.programId)}`, {
      method: "POST",
      body: { amount: input.amount, currency: input.currency, items: input.items },
      schema: paymentIntentSchema,
    }),
  },
};
