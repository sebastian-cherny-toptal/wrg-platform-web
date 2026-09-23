import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
    expect(preview).toHaveBeenCalledWith(
      "program-2026",
      {
        positive: [80, 100],
      },
      false,
    );
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
    expect(preview).toHaveBeenCalledWith(
      "program-2026",
      {
        neutral: [60, 79],
        negative: [10, 20],
      },
      false,
    );
    expect(
      screen.getByText(
        "All selected patterns will appear together in a single color-coded document.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Response pattern distribution" }),
    ).toBeVisible();
  });

  it("accepts only complete integer ranges and retains disabled values", () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("e.g., 60–79%");
    const toggle = screen.getByRole("button", {
      name: "Enable Moderate % Agreement",
    });
    fireEvent.focus(input);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(input, { target: { value: "60.5-79" } });
    expect(
      screen.getByText("Enter a complete integer range like 60-79%."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Preview the Report" }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "60-79%" } });
    expect(
      screen.queryByText("Enter a complete integer range like 60-79%."),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(input).toHaveValue("60-79%");
  });

  it("shows a no-match state and an actionable download failure", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [],
    });
    vi.spyOn(api.reports, "previewResponsePatterns").mockResolvedValue({
      success: true,
      message: "success",
      data: {
        heatmapPreview: [],
        percentage: { positivePercentage: 0, greenPercentage: 0 },
      },
    });
    let rejectDownload: (reason: Error) => void = () => undefined;
    vi.spyOn(api.reports, "downloadResponsePatternsWorkbook").mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectDownload = reject;
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enable High % Agreement" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview the Report" }));
    expect(
      await screen.findByText(
        "No cells match the selected range. Try widening the range.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Download Report" }));
    expect(screen.getByText("Compiling report…")).toBeVisible();
    act(() => rejectDownload(new Error("Network unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
  });

  it("uses sample mode for promotional preview and invalidates on program change", async () => {
    useAppStore.getState().setSession({
      ...session,
      user: {
        ...session.user,
        role: "promotional",
        programs: [
          ...session.user.programs,
          {
            id: "program-2025",
            name: "Example 2025",
            year: 2025,
            organizationName: "Example Organization",
            entitlements: { WFR_Access: "no" },
          },
        ],
      },
    });
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
          heatmapPreview: [],
          percentage: { positivePercentage: 5, greenPercentage: 5 },
        },
      });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(
        "Viewing sample report data from a fictional organization.",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Enable High % Agreement" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview the Report" }));
    expect(await screen.findByText("5%")).toBeVisible();
    expect(preview).toHaveBeenCalledWith(
      "program-2026",
      { positive: [80, 100] },
      true,
    );
    expect(
      screen.getByRole("button", { name: "Download Report" }),
    ).toBeEnabled();

    act(() => useAppStore.getState().selectProgram("program-2025"));
    expect(
      screen.getByRole("button", { name: "Download Report" }),
    ).toBeDisabled();
  });

  it("shows preview loading and failure states", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "responseBreakdownBySection").mockResolvedValue({
      success: true,
      message: "success",
      isConfidential: false,
      data: [],
    });
    let rejectPreview: (reason: Error) => void = () => undefined;
    vi.spyOn(api.reports, "previewResponsePatterns").mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPreview = reject;
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ResponsePatternsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enable High % Agreement" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview the Report" }));
    expect(
      screen.getByRole("button", { name: "Generating preview…" }),
    ).toBeDisabled();
    act(() => rejectPreview(new Error("Preview unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview unavailable",
    );
  });
});
