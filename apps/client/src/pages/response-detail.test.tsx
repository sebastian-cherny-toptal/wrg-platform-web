import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { ResponseDetailPage } from "./client-reports";

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
        name: "San Diego 2026",
        year: 2026,
        organizationName: "Health Organization",
        entitlements: { RD_Access: "yes" },
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Response Detail page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("offers full and selected-filter workbook downloads", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "surveyFilters").mockResolvedValue([
      {
        questionId: "filter-gender",
        label: "Gender",
        options: [
          { label: "Female", values: ["Female"] },
          { label: "Male", values: ["Male"] },
        ],
      },
    ]);
    vi.spyOn(api.reports, "responseDetailSections").mockResolvedValue({
      success: true,
      message: "success",
      data: [],
    });
    const download = vi
      .spyOn(api.reports, "downloadResponseDetailWorkbook")
      .mockResolvedValue();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResponseDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("Filter: Gender");
    fireEvent.click(screen.getByRole("button", { name: /Download Report/u }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Download full report" }),
    );
    await waitFor(() => expect(download).toHaveBeenCalledWith("program-2026"));

    fireEvent.click(screen.getByRole("button", { name: /Download Report/u }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Download filtered report" }),
    );
    await waitFor(() =>
      expect(download).toHaveBeenCalledWith("program-2026", "filter-gender"),
    );
  });
});
