import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { ComparisonDataPage } from "./client-reports";

const session: Session = {
  user: {
    id: "client-1",
    displayName: "Client User",
    email: "client@example.test",
    role: "client",
    permissions: [],
    programs: [{
      id: "program-1",
      name: "Test program",
      year: 2026,
      organizationName: "Example Organization",
      entitlements: { WBC_Access: "yes" },
    }],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Comparison Data cohort suppression", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("shows x for a suppressed cohort and 0% for an eligible zero result", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [{
        "Core Employee Experience": [{
          ResponseCaption: "Agree",
          numberOfResponses: 8,
          colorCode: "#00a46a",
          percent: 0.8,
          percentage: 80,
        }],
      }],
    });
    vi.spyOn(api.reports, "workforceComparison").mockResolvedValue({
      success: true,
      message: "true",
      data: {
        tableHeaders: [
          { title: "Small Winners", type: "Small_Yes", color: "#000" },
          { title: "Small Non-Winners", type: "Small_No", color: "#000" },
        ],
        data: [{
          title: "Core Employee Experience",
          dataValues: ["x", 0],
          nestedData: [{ title: "Question", dataValues: ["x", 0] }],
          legends: [],
        }],
        surveyAverage: [],
      },
    });
    vi.spyOn(api.reports, "comparisonQuestions").mockImplementation(
      (_programId, _category, selectedCohort) => Promise.resolve({
        success: true,
        message: "success",
        data: { questionResponse: [{
          question: "Question",
          currentOrg: 80,
          otherOrg: selectedCohort === "SmallYes" ? "x" : 0,
        }] },
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><ComparisonDataPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Core Employee Experience")).toBeVisible();
    const currentProgramLabel = screen.getByText("Your Results");
    expect(currentProgramLabel.previousElementSibling).toHaveStyle({
      background: "conic-gradient(#7c3aed 288deg, #ede9fe 0deg)",
    });
    expect(screen.getByText("x", { selector: "strong" })).toBeVisible();
    fireEvent.click(screen.getByText("Core Employee Experience"));
    expect(await screen.findByLabelText("Small Winners: x")).toBeVisible();
    expect(
      (await screen.findByLabelText("Your Results: 80%")).firstElementChild,
    ).toHaveClass("bg-violet-600");

    fireEvent.click(screen.getByRole("button", { name: "Small Non-Winners" }));
    expect(await screen.findByText("0%", { selector: "strong" })).toBeVisible();
    expect(await screen.findByLabelText("Small Non-Winners: 0%")).toBeVisible();
  });
});
