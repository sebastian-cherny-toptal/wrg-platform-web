import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import {
  BenchmarkDataPage,
  BenefitsBestPracticesPage,
  ComparisonDataPage,
} from "./client-reports";

const session: Session = {
  user: {
    id: "client-1",
    displayName: "Client User",
    email: "client@example.test",
    role: "client",
    permissions: [],
    programs: [
      {
        id: "program-1",
        name: "Test program",
        year: 2026,
        organizationName: "Example Organization",
        entitlements: {
          WBC_Access: "yes",
          BBP_Access: "yes",
        },
        benchmarkReportsAvailable: false,
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

function renderPage(page: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("benchmark page availability", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it.each([
    ["Benchmark Data", <BenchmarkDataPage />],
    ["Comparison Data", <ComparisonDataPage />],
    ["Benefits & Best Practices", <BenefitsBestPracticesPage />],
  ])("shows an empty state on the %s page", (title, page) => {
    useAppStore.getState().setSession(session);
    const workforceComparison = vi.spyOn(
      api.reports,
      "workforceComparison",
    );
    const responseBreakdown = vi.spyOn(
      api.reports,
      "responseBreakdownBySection",
    );
    const employerBenchmark = vi.spyOn(api.reports, "employerBenchmark");

    renderPage(page);

    expect(
      screen.getByRole("heading", { name: new RegExp(`^${title} 2026$`) }),
    ).toBeVisible();
    expect(
      screen.getByText("There is still no benchmark information for this program."),
    ).toBeVisible();
    expect(workforceComparison).not.toHaveBeenCalled();
    expect(responseBreakdown).not.toHaveBeenCalled();
    expect(employerBenchmark).not.toHaveBeenCalled();
  });
});
