import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { KeyImpactAnalysisPage } from "./client-reports";

const question = "I understand how my work impacts organizational success";

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
        name: "Example 2026",
        year: 2026,
        organizationName: "Example Organization",
        entitlements: { KIA_Access: "yes" },
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Key Impact Analysis page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("renders contribution bubbles and opens their details", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "catalog").mockResolvedValue([]);
    vi.spyOn(api.reports, "keyImpactAnalysis").mockResolvedValue({
      success: true,
      message: "success",
      data: {
        mapping: { [question]: 15.49 },
        report: [
          { label: "Your Job", key: question, value: 0.1549 },
        ],
        data: { signedUrl: null },
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <KeyImpactAnalysisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const bubble = await screen.findByLabelText(
      `${question}, 15.49% of contribution`,
    );
    fireEvent.click(bubble);

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("15.49% of contribution")).toBeVisible();
    expect(screen.getAllByText("Your Job").length).toBeGreaterThan(0);
  });

  it("requests fake data and shows the purchase banner in demo mode", async () => {
    useAppStore.getState().setSession(session);
    const analysis = vi.spyOn(api.reports, "keyImpactAnalysis").mockResolvedValue({
      success: true,
      message: "success",
      data: {
        mapping: { [question]: 15.49 },
        report: [{ label: "Your Job", key: question, value: 0.1549 }],
        data: { signedUrl: null },
      },
    });
    vi.spyOn(api.reports, "catalog").mockResolvedValue([{
      id: "report-kia",
      name: "Key Impact Analysis",
      description: "Demo product",
      priceCents: 50000,
      available: true,
      purchaseMode: "checkout",
      fulfillment: "manual",
      requiresStandardPackage: true,
      priceAvailable: true,
      owned: false,
      standardPackageOwned: true,
      purchasable: true,
      deliveryMessage: "Available after purchase",
    }]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/key-impact-analysis?demo=report-kia"]}>
          <KeyImpactAnalysisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Viewing demo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeVisible();
    expect(analysis).toHaveBeenCalledWith("program-2026", true);
  });
});
