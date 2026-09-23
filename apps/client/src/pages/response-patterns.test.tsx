import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { ResponsePatternsPage } from "./client-reports";

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
        entitlements: { WFR_Access: "yes" },
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Response Patterns page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("renders the two-decimal High Agreement preview returned by the API", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [],
    });
    const preview = vi
      .spyOn(api.reports, "previewResponsePatterns")
      .mockResolvedValue({
        success: true,
        message: "success",
        data: {
          heatmapPreview: [{ row: 6, col: 4, color: "positive", value: 87.5 }],
          percentage: {
            positivePercentage: 18.56,
            greenPercentage: 18.56,
          },
        },
      });

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enable High % Agreement" }),
    );
    expect(screen.getByPlaceholderText("e.g., 80–100%")).toHaveValue("80-100%");
    fireEvent.click(screen.getByRole("button", { name: "Preview the Report" }));

    expect(await screen.findByText("18.56%")).toBeVisible();
    expect(preview).toHaveBeenCalledWith("program-2026", {
      positive: [80, 100],
    });
    expect(
      screen.getByRole("button", { name: "Download Report" }),
    ).toBeEnabled();
  });

  it("previews Moderate Agreement and High Disagreement together", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [],
    });
    const preview = vi
      .spyOn(api.reports, "previewResponsePatterns")
      .mockResolvedValue({
        success: true,
        message: "success",
        data: {
          heatmapPreview: [
            { row: 6, col: 4, color: "neutral", value: 75 },
            { row: 6, col: 5, color: "negative", value: 20 },
          ],
          percentage: {
            neutralPercentage: 10.53,
            negativePercentage: 4.21,
            bluePercentage: 10.53,
            redPercentage: 4.21,
          },
        },
      });

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enable Moderate % Agreement" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enable High % Disagreement" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview the Report" }));

    expect(await screen.findByText("10.53%")).toBeVisible();
    expect(screen.getByText("4.21%")).toBeVisible();
    expect(preview).toHaveBeenCalledWith("program-2026", {
      neutral: [60, 79],
      negative: [10, 20],
    });
  });
});
