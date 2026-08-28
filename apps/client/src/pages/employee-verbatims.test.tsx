import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { EmployeeVerbatimsPage } from "./client-reports";

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
        entitlements: { EV_Access: "yes" },
      },
    ],
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
};

describe("Employee Verbatims page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.getState().setSession(null);
  });

  it("keeps questions closed until their row is clicked", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "openResponseQuestions").mockResolvedValue({
      success: true,
      message: "success",
      data: [
        {
          caption: "What makes this a great place to work?",
          id: "question-1",
          _id: "question-1",
          questionNumber: 1,
        },
      ],
    });
    const answers = vi
      .spyOn(api.reports, "openResponseAnswers")
      .mockResolvedValue({
        success: true,
        message: "success",
        data: {
          respondentData: [
            {
              _id: "respondent-1",
              RespondentId: "respondent-1",
              responses: {
                QuestionId: "question-1",
                DataLabel: "q_OpenEnded_1",
                Value: "The people and the supportive culture.",
                ResponseCaption: " ",
              },
            },
          ],
          dataLen: 1,
          queryQuestion: {
            Caption: "What makes this a great place to work?",
            Id: "question-1",
            DataLabel: "q_OpenEnded_1",
          },
        },
      });
    vi.spyOn(api.reports, "catalog").mockResolvedValue([]);
    vi.spyOn(api.reports, "surveyFilters").mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EmployeeVerbatimsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const question = await screen.findByText("What makes this a great place to work?");
    expect(answers).not.toHaveBeenCalled();
    await userEvent.click(question);
    expect(await screen.findByText("The people and the supportive culture.")).toBeVisible();
    expect(answers).toHaveBeenCalledWith("program-2026", "question-1");
  });

  it("requires a sorting category in the demo add-to-cart prompt", async () => {
    useAppStore.getState().setSession(session);
    vi.spyOn(api.reports, "openResponseQuestions").mockResolvedValue({
      success: true,
      message: "success",
      data: [],
    });
    vi.spyOn(api.reports, "catalog").mockResolvedValue([{
      id: "report-verbatims-sorted",
      name: "Sorted Employee Verbatims",
      description: "Sort responses",
      priceCents: 42_500,
      available: true,
      purchaseMode: "checkout",
      fulfillment: "instant",
      requiresStandardPackage: true,
      priceAvailable: true,
      owned: false,
      standardPackageOwned: true,
      purchasable: true,
      deliveryMessage: "Instant access",
    }]);
    vi.spyOn(api.reports, "surveyFilters").mockResolvedValue([
      { questionId: "department", label: "Department", options: [] },
      { questionId: "location", label: "Location", options: [] },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/employee-verbatims?demo=report-verbatims-sorted"]}>
          <EmployeeVerbatimsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const prompt = (await screen.findByText("Viewing demo")).closest<HTMLElement>('[role="status"]');
    if (!prompt) throw new Error("Demo purchase prompt was not rendered");
    const addButton = within(prompt).getByRole("button", { name: "Add to cart" });
    expect(addButton).toBeDisabled();
    await user.click(within(prompt).getByRole("button", { name: "Demo sorting category" }));
    await user.click(screen.getByRole("option", { name: "Department" }));
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    expect(useAppStore.getState().cart[0]).toMatchObject({
      keys: { EV_Sorting_Filter: "department" },
      optionLabel: "Department",
    });
  });
});
