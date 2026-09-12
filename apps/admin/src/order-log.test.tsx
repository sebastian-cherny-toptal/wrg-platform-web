import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderLogPage } from "./admin";
import { api } from "./api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("order log", () => {
  it("shows a friendly sorting filter in the product column", async () => {
    vi.spyOn(api, "orders").mockResolvedValue([
      {
        createdAt: "2026-09-12T10:00:00.000Z",
        purchaserUsername: "admin@example.com",
        organizationName: "Acme",
        productName: "Sorted Employee Verbatims agegeneration",
        amountMinor: 42_500,
        currency: "USD",
        sortingFilter: "agegeneration",
        paymentMethod: "Card",
        programName: "Program 2026",
        status: "PAID",
      },
    ]);

    render(
      <MemoryRouter>
        <OrderLogPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sorted Employee Verbatims")).toBeTruthy();
    expect(screen.getByText("(Age Generation)").tagName).toBe("STRONG");
    expect(
      screen.queryByRole("columnheader", { name: "Sorting Filter" }),
    ).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });

  it("uses the resolved demographic label for internal question references", async () => {
    const sortingQuestionReference =
      "seed-br-question-2026-efs-0dbcf364a57f";
    vi.spyOn(api, "orders").mockResolvedValue([
      {
        createdAt: "2026-09-12T10:00:00.000Z",
        purchaserUsername: "admin@example.com",
        organizationName: "Acme",
        productName: `Key Impact Analysis, Sorted Employee Verbatims ${sortingQuestionReference}`,
        amountMinor: 124_500,
        currency: "USD",
        sortingFilter: sortingQuestionReference,
        sortingFilterLabel: "Age Generation",
        paymentMethod: "Card",
        programName: "Program 2026",
        status: "PAID",
      },
    ]);

    render(
      <MemoryRouter>
        <OrderLogPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "TD" &&
          element.textContent ===
            "Key Impact Analysis, Sorted Employee Verbatims (Age Generation)",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Seed Br Question 2026 Efs/),
    ).toBeNull();
  });

  it("places the sorting filter immediately after Sorted Employee Verbatims", async () => {
    vi.spyOn(api, "orders").mockResolvedValue([
      {
        createdAt: "2026-09-12T10:00:00.000Z",
        purchaserUsername: "admin@example.com",
        organizationName: "Acme",
        productName:
          "Sorted Employee Verbatims, Key Impact Analysis, Response Detail Report",
        amountMinor: 167_000,
        currency: "USD",
        sortingFilter: "department",
        paymentMethod: "Card",
        programName: "Program 2026",
        status: "PAID",
      },
    ]);

    render(
      <MemoryRouter>
        <OrderLogPage />
      </MemoryRouter>,
    );

    const filter = await screen.findByText("(Department)");
    expect(filter.tagName).toBe("STRONG");
    expect(filter.parentElement?.innerHTML).toBe(
      "Sorted Employee Verbatims <strong>(Department)</strong>, Key Impact Analysis, Response Detail Report",
    );
  });
});
