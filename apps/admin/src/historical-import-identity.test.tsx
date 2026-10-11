import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { WinnersStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows RD and KIA payment types when reviewing a new historical program", () => {
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
              rdPaymentType: "Credit Card",
              kiaPaymentType: "Invoice",
              isWinner: "Y",
              isIncluded: true,
            },
            {
              organizationKey: "missing",
              organizationName: "Missing payments",
              surveysSent: 20,
              isWinner: null,
              isIncluded: true,
            },
          ],
        },
      }}
      onComplete={vi.fn()}
      onBack={vi.fn()}
      onRestart={vi.fn()}
    />,
  );

  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader");
  const rdIndex = headers.findIndex(
    (header) => header.textContent === "RD Payment Type",
  );
  expect(headers[rdIndex + 1]?.textContent).toBe("KIA Payment Type");

  const rows = within(table).getAllByRole("row");
  const acmeCells = within(rows[1]!).getAllByRole("cell");
  expect(acmeCells[rdIndex]?.textContent).toBe("Credit Card");
  expect(acmeCells[rdIndex + 1]?.textContent).toBe("Invoice");
  const missingCells = within(rows[2]!).getAllByRole("cell");
  expect(missingCells[rdIndex]?.textContent).toBe("-");
  expect(missingCells[rdIndex + 1]?.textContent).toBe("-");
});

it("continues a new program without loading options or assigning existing organizations", () => {
  const options = vi.spyOn(api, "organizationOptions");
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
            {
              organizationKey: "renamed",
              organizationName: "Renamed Company",
              zohoAccountId: "crm-42",
              canonicalOrganizationId: "old-name-selection",
              surveysSent: 20,
              isWinner: "N",
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
  expect(options).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Company identity/ })).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: /Continue/ })[0]!);
  expect(complete).toHaveBeenCalledOnce();
  expect(complete.mock.calls[0]?.[0].metadata.organizationPrograms).toEqual([
    expect.objectContaining({ organizationKey: "acme", surveysSent: 30 }),
    expect.objectContaining({
      organizationKey: "renamed",
      zohoAccountId: "crm-42",
    }),
  ]);
  for (const organization of complete.mock.calls[0]?.[0].metadata
    .organizationPrograms) {
    expect(organization.canonicalOrganizationId).toBeUndefined();
  }
});

it("retains existing enrollment identity when continuing a reimport", () => {
  const complete = vi.fn();
  render(
    <WinnersStep
      draft={{
        metadata: {
          programName: "2026",
          programId: "program-2026",
          organizationPrograms: [
            {
              organizationProgramId: "enrollment-1",
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
  fireEvent.click(screen.getAllByRole("button", { name: /Continue/ })[1]!);
  expect(
    complete.mock.calls[0]?.[0].metadata.organizationPrograms[0]
      .organizationProgramId,
  ).toBe("enrollment-1");
});
