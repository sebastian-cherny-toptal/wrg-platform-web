import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { DashboardPage } from "./client";

const session: Session = {
  user: {
    id: "promotional-1",
    displayName: "Preview User",
    email: "preview@example.test",
    role: "promotional",
    permissions: [],
    programs: [
      {
        id: "program-1",
        name: "Example 2026",
        year: 2026,
        organizationName: "Private Organization",
        entitlements: {},
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAppStore.getState().setSession(null);
});

it("requests sample dashboard data and labels the preview after the invitation is dismissed", async () => {
  useAppStore.getState().setSession(session);
  const overview = vi
    .spyOn(api.dashboard, "overview")
    .mockImplementation((_programId, isDummy) =>
      Promise.resolve({
        agreement: {
          percentage: isDummy ? 72 : 98765,
          negativePercentage: 18,
          totalRespondents: 90,
          StartDate: null,
          EndDate: null,
          numberOfQuestions: 35,
        },
        responseRate: {
          sendSurvey: isDummy ? 120 : 98765,
          completedSurvey: 90,
          responseRate: 75,
          Total_Number_of_Program_EEs: 150,
          Total_Number_of_National_EEs: 0,
        },
        statements: {
          top: [
            {
              title: isDummy ? "Sample statement" : "PRIVATE RESULT",
              percentage: 88,
            },
          ],
          bottom: [],
          noteTop: "Sample notes",
          noteBottom: "Sample notes",
        },
      }),
    );

  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole("dialog", { name: "The results are in!" }),
  ).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(await screen.findByText("Sample dashboard preview")).toBeVisible();
  expect(overview).toHaveBeenCalledWith("program-1", true);
  const sampleStatement = screen.getByText("Sample statement");
  expect(sampleStatement).toBeVisible();
  expect(sampleStatement.closest(".blur-xl")).not.toBeNull();
  expect(screen.queryByText("PRIVATE RESULT")).not.toBeInTheDocument();
});

it("keeps the live dashboard request for a normal client", async () => {
  useAppStore.getState().setSession({
    ...session,
    user: { ...session.user, role: "client" },
  });
  const overview = vi.spyOn(api.dashboard, "overview").mockResolvedValue({
    agreement: {
      percentage: 72,
      negativePercentage: 18,
      totalRespondents: 90,
      StartDate: null,
      EndDate: null,
      numberOfQuestions: 35,
    },
    responseRate: {
      sendSurvey: 120,
      completedSurvey: 90,
      responseRate: 75,
      Total_Number_of_Program_EEs: 150,
      Total_Number_of_National_EEs: 0,
    },
    statements: {
      top: [{ title: "Real client statement", percentage: 88 }],
      bottom: [],
      noteTop: "Real notes",
      noteBottom: "Real notes",
    },
  });

  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  const realStatement = await screen.findByText("Real client statement");
  expect(realStatement).toBeVisible();
  expect(realStatement.closest(".blur-xl")).toBeNull();
  expect(overview).toHaveBeenCalledWith("program-1", false);
  expect(
    screen.queryByText("Sample dashboard preview"),
  ).not.toBeInTheDocument();
});
