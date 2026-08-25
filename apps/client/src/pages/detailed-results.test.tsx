import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { DetailedResultsPage } from "./client-reports";

const session: Session = {
  user: {
    id: "client-1",
    displayName: "Client User",
    email: "client@example.test",
    role: "client",
    permissions: [],
    programs: [
      {
        id: "program-2026",
        name: "Baton Rouge 2026",
        year: 2026,
        organizationName: "Example Organization",
        entitlements: { WFR_Access: "yes" },
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Detailed Results page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("places question details directly after the selected category card", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "surveyFilters").mockResolvedValue([]);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [
        {
          "Core Employee Experience": [
            {
              ResponseCaption: "Agree",
              numberOfResponses: 8,
              colorCode: "#00a46a",
              percent: 0.8,
              percentage: 80,
            },
            {
              ResponseCaption: "Neutral",
              numberOfResponses: 1,
              colorCode: "#ffc955",
              percent: 0.1,
              percentage: 10,
            },
            {
              ResponseCaption: "Disagree",
              numberOfResponses: 1,
              colorCode: "#c00000",
              percent: 0.1,
              percentage: 10,
            },
            {
              totalNumberOfQuestionsPerSection: 1,
              totalNumberOfResponsePerSection: 10,
              totalRespondents: 10,
              questionRange: ["question-1"],
            },
          ],
        },
      ],
    });
    vi.spyOn(api.reports, "responseBreakdown").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [
        {
          question: "I can do my best work.",
          questionId: "question-1",
          responses: [
            {
              ResponseCaption: "Strongly Agree",
              numberOfResponses: 10,
              percent: 100,
              colorCode: "#00a46a",
            },
          ],
        },
      ],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DetailedResultsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const categoryButtons = await screen.findAllByRole("button", {
      name: /Core Employee Experience/u,
    });
    const card = categoryButtons.find((element) => element.tagName === "DIV");
    expect(card).toBeDefined();
    if (!card) throw new Error("Category card was not rendered");
    fireEvent.click(card);
    const detailPanel = await screen.findByText(
      "Question-level response details",
    );
    expect(card.nextElementSibling).toBe(detailPanel.closest("section"));
    expect(
      await screen.findByText("Strongly Agree: 100% (10 responses)"),
    ).toBeVisible();
  });
});
