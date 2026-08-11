import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { api, responsePatternsPath } from "./client";
import { clientSession } from "../fixtures/data";
import { server } from "../test/setup";

describe("fixture session persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("restores an authenticated fixture session after a page refresh", async () => {
    const login = await api.auth.clientLogin({
      username: "demo-client",
      email: "client@example.invalid",
    });

    if (login.status !== "authenticated")
      throw new Error("Fixture login did not authenticate");
    expect(await api.session.get()).toEqual(login.session);
  });

  it("clears the persisted fixture session on logout", async () => {
    await api.auth.clientLogin({
      username: "demo-client",
      email: "client@example.invalid",
    });
    await api.session.logout();

    expect(await api.session.get()).toBeNull();
  });
});

describe("administrator preview exchange", () => {
  it("deduplicates Strict Mode exchange attempts for a single-use grant", async () => {
    let exchangeCount = 0;
    server.use(
      http.post(
        "http://localhost:3000/api/auth/impersonations/exchange",
        () => {
          exchangeCount += 1;
          return HttpResponse.json({
            accessToken: "preview-token",
            session: clientSession,
          });
        },
      ),
    );

    const [first, second] = await Promise.all([
      api.auth.exchangeImpersonation("single-use-grant"),
      api.auth.exchangeImpersonation("single-use-grant"),
    ]);

    expect(exchangeCount).toBe(1);
    expect(first).toEqual(clientSession);
    expect(second).toEqual(clientSession);
  });
});

describe("response-pattern report requests", () => {
  it("builds the preview request with the legacy range contract", () => {
    const path = responsePatternsPath(
      "68cac532bf1e6966358a8079",
      { neutral: [60, 79] },
      true,
    );
    const url = new URL(path, "https://api.feedbackdatadashboard.com");

    expect(url.pathname).toBe("/client/generateHeatMap");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      selectedProgramId: "68cac532bf1e6966358a8079",
      patternMode: "range",
      includePositive: "false",
      includeNeutral: "true",
      includeNegative: "false",
      neutralMin: "60",
      neutralMax: "79",
      isPreview: "true",
    });
  });

  it("omits isPreview for the XLSX download request", () => {
    const url = new URL(
      responsePatternsPath("program", { positive: [80, 100] }),
      "https://api.feedbackdatadashboard.com",
    );

    expect(url.searchParams.get("positiveMin")).toBe("80");
    expect(url.searchParams.get("positiveMax")).toBe("100");
    expect(url.searchParams.has("isPreview")).toBe(false);
  });
});

describe("detailed-results filter requests", () => {
  it("normalizes standard and grouped survey filter options", async () => {
    server.use(
      http.get("http://localhost:3000/client/fetchSurveyFilter", () =>
        HttpResponse.json({
          success: true,
          message: "success",
          data: [
            {
              QuestionId: 214,
              filterLabel: "Department",
              filterOption: [{ Caption: "Finance", ResponseId: 1 }],
            },
            {
              QuestionId: "age-generation",
              filterLabel: "Age Generation",
              filterOption: {
                "Generation X": ["Born 1965 to 1980"],
              },
            },
          ],
        }),
      ),
    );

    await expect(api.reports.surveyFilters("program")).resolves.toEqual([
      {
        questionId: "214",
        label: "Department",
        options: [{ label: "Finance", values: ["Finance"] }],
      },
      {
        questionId: "age-generation",
        label: "Age Generation",
        options: [{ label: "Generation X", values: ["Born 1965 to 1980"] }],
      },
    ]);
  });

  it("sends selected values as queryFilter when refreshing results", async () => {
    let requestBody: unknown;
    server.use(
      http.post(
        "http://localhost:3000/client/employeeResponseBreakdownBySection",
        async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            success: true,
            message: "success",
            isConfidential: false,
            data: [],
          });
        },
      ),
    );

    await api.reports.responseBreakdownBySection("program", {
      "department-question": ["Finance", "Human Resources"],
    });

    expect(requestBody).toEqual({
      queryFilter: {
        "department-question": ["Finance", "Human Resources"],
      },
    });
  });
});
