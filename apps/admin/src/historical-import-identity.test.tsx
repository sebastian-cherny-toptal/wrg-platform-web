import {
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
});

it("reuses a verified CRM account despite its changed company name", async () => {
  vi.spyOn(api, "organizationOptions").mockResolvedValue([
    {
      id: "canonical",
      name: "Old Company",
      zohoAccountId: "crm-42",
      programIds: ["2025"],
    },
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

it("requires explicit company identity when only a matching name exists", async () => {
  vi.spyOn(api, "organizationOptions").mockResolvedValue([
    { id: "company", name: "Acme", programIds: [] },
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
  await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(next);
  expect(complete).not.toHaveBeenCalled();
  expect(
    screen.getByText(
      "Choose an existing company or Create new for each organization.",
    ),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Company identity for Acme" }),
  );
  fireEvent.click(
    await screen.findByRole("option", { name: "Create new company" }),
  );
  fireEvent.click(next);
  expect(
    complete.mock.calls[0]?.[0].metadata.organizationPrograms[0]
      .canonicalOrganizationId,
  ).toBe("new");
});
