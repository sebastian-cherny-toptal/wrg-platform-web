import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { WinnersStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("reuses a verified CRM account despite its changed company name", async () => {
  vi.spyOn(api, "organizationOptions").mockResolvedValue([
    {
      id: "canonical",
      name: "Old Company",
      zohoAccountId: "crm-42",
      programIds: ["2025"],
    },
    { id: "name-match", name: "Renamed Company", programIds: [] },
  ]);
  const complete = vi.fn();
  render(
    <WinnersStep
      draft={{
        metadata: {
          programName: "2026",
          organizationPrograms: [
            {
              organizationKey: "renamed",
              organizationName: "Renamed Company",
              zohoAccountId: "crm-42",
              surveysSent: 30,
              isWinner: "Y",
              isIncluded: true,
            },
          ],
        },
      }}
      onComplete={complete}
      onBack={vi.fn()}
      onRestart={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", {
        name: "Company identity for Renamed Company",
      }).textContent,
    ).toContain("Old Company"),
  );
  fireEvent.click(screen.getAllByRole("button", { name: /Continue/ })[0]!);
  expect(
    complete.mock.calls[0]?.[0].metadata.organizationPrograms[0]
      .canonicalOrganizationId,
  ).toBe("canonical");
});

it.each(["Acme", " acme "])(
  "preselects an existing company named %s",
  async (name) => {
    vi.spyOn(api, "organizationOptions").mockResolvedValue([
      { id: "company", name, programIds: [] },
    ]);
    const complete = vi.fn();
    render(
      <WinnersStep
        draft={{
          metadata: {
            programName: "2026",
            organizationPrograms: [
              {
                organizationKey: "acme",
                organizationName: "Acme",
                surveysSent: 30,
                isWinner: "Y",
                isIncluded: true,
              },
            ],
          },
        }}
        onComplete={complete}
        onBack={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const next = screen.getAllByRole("button", { name: /Continue/ })[0]!;
    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(next);
    expect(
      complete.mock.calls[0]?.[0].metadata.organizationPrograms[0]
        .canonicalOrganizationId,
    ).toBe("company");
  },
);

it("highlights missing assignments, scrolls to the first visible missing row, and dismisses the notice after five seconds", async () => {
  vi.spyOn(api, "organizationOptions").mockResolvedValue([]);
  const scrollIntoView = vi.fn();
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  const complete = vi.fn();
  try {
    render(
      <WinnersStep
        draft={{
          metadata: {
            programName: "2026",
            organizationPrograms: ["Zebra", "Acme"].map((name) => ({
              organizationKey: name,
              organizationName: name,
              surveysSent: 30,
              isWinner: "Y",
              isIncluded: true,
            })),
          },
        }}
        onComplete={complete}
        onBack={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const next = screen.getAllByRole("button", { name: /Continue/ })[0]!;
    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );
    const acme = screen.getByRole("button", {
      name: "Company identity for Acme",
    });
    expect(
      acme.closest("tr")?.classList.contains("organization-unassigned-row"),
    ).toBe(true);
    vi.useFakeTimers();
    fireEvent.click(next);
    expect(complete).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(scrollIntoView.mock.instances[0]).toBe(acme.closest("tr"));
    expect(document.activeElement).toBe(acme);
    expect(screen.getByRole("alert").textContent).toBe(
      "Assign an organization from the project to every organization's row",
    );
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.queryByRole("alert")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("alert")).toBeNull();
    vi.useRealTimers();
    fireEvent.click(acme);
    fireEvent.click(
      await screen.findByRole("option", { name: "Create new company" }),
    );
    expect(
      acme.closest("tr")?.classList.contains("organization-unassigned-row"),
    ).toBe(false);
    fireEvent.click(next);
    expect(scrollIntoView.mock.instances[1]).toBe(
      screen
        .getByRole("button", { name: "Company identity for Zebra" })
        .closest("tr"),
    );
  } finally {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  }
});
