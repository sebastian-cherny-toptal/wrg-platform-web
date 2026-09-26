import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../api/schemas";
import { api } from "../api/client";
import { KeyImpactAnalysisPage } from "../pages/client-reports";
import { useAppStore } from "../store/app-store";
import { AppShell } from "./shell";

const deniedEntitlements = {
  WFR_Access: "no",
  EV_Access: "no",
  WBC_Access: "no",
  BBP_Access: "no",
  RD_Access: "no",
  KIA_Access: "no",
  CR_Access: "no",
} as const;

function session(): Session {
  return {
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
          entitlements: deniedEntitlements,
        },
      ],
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    impersonation: null,
  };
}

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Link to="/programs">Programs</Link>} />
            <Route path="/programs" element={<Link to="/dashboard">Return to dashboard</Link>} />
            <Route path="/key-impact-analysis" element={<KeyImpactAnalysisPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAppStore.getState().setSession(null);
});

describe("client sidebar", () => {
  it("keeps purchased-report links hidden for a client without entitlements", async () => {
    useAppStore.getState().setSession(session());
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByText("My Reports", { selector: "summary span" }));

    expect(
      screen.queryByRole("link", { name: "Employee Response Breakdown" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Benefits & Best Practices" }),
    ).not.toBeInTheDocument();
  });

  it("hides benchmark links until ranking information is available", async () => {
    const unrankedSession = session();
    const program = unrankedSession.user.programs[0];
    if (!program) throw new Error("Missing test program");
    program.entitlements = { ...program.entitlements, WBC_Access: "yes" };
    program.benchmarkReportsAvailable = false;
    useAppStore.getState().setSession(unrankedSession);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByText("My Reports", { selector: "summary span" }));

    expect(screen.queryByText("Workforce Benchmark Comparisons")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Benchmark Data" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comparison Data" })).not.toBeInTheDocument();
  });

  it("always shows Employee Verbatims even without EV_Access", async () => {
    useAppStore.getState().setSession(session());
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByText("My Reports"));

    expect(
      screen.getByRole("link", { name: "Employee Verbatims" }),
    ).toBeVisible();
  });

  it("refreshes only the uploaded program's pending KIA label on in-app navigation", async () => {
    const pendingSession = session();
    const baseProgram = pendingSession.user.programs[0];
    if (!baseProgram) throw new Error("Missing test program");
    pendingSession.user.programs = [
      { ...baseProgram, entitlements: { KIA_Access: "yes" }, reportSelections: { KIA_Order_Status: "Processing" } },
      { ...baseProgram, id: "program-2025", year: 2025, entitlements: { KIA_Access: "yes" }, reportSelections: { KIA_Order_Status: "Processing" } },
    ];
    useAppStore.getState().setSession(pendingSession);
    let delivered = false;
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: [
          { programId: "program-2026", status: delivered ? "Delivered" : "Processing" },
          { programId: "program-2025", status: "Processing" },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(api.reports, "catalog").mockResolvedValue([]);
    const analysis = vi.spyOn(api.reports, "keyImpactAnalysis").mockImplementation(() => Promise.resolve({
      success: true,
      message: "success",
      data: {
        mapping: delivered ? { leadership: 42 } : {},
        report: delivered ? [{ label: "Leadership", key: "leadership", value: 0.42 }] : [],
        data: { signedUrl: null },
      },
    }));
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByText("My Reports"));
    expect(screen.getByRole("link", { name: "Key Impact Analysis (not yet uploaded)" })).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole("link", { name: "Key Impact Analysis (not yet uploaded)" }));
    expect(await screen.findByText("Key Impact Analysis not yet uploaded")).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Dashboard" }));

    delivered = true;
    await user.click(screen.getByRole("link", { name: "Programs" }));
    expect(await screen.findByRole("link", { name: "Key Impact Analysis" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Key Impact Analysis" }));
    const reportTable = await screen.findByRole("table", { name: "Key Impact Analysis contributions ranked from highest to lowest" });
    expect(within(reportTable).getByText("42.0%")).toBeVisible();
    expect(analysis).toHaveBeenCalledTimes(2);
    act(() => useAppStore.getState().selectProgram("program-2025"));
    await user.click(screen.getByText("My Reports", { selector: "summary span" }));
    expect(screen.getByRole("link", { name: "Key Impact Analysis (not yet uploaded)" })).toBeVisible();
  });
});
