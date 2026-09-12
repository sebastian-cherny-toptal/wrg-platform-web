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
        productName: "Employee Verbatim agegeneration",
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

    expect(await screen.findByText("Employee Verbatim")).toBeTruthy();
    expect(screen.getByText("(Age Generation)").tagName).toBe("STRONG");
    expect(
      screen.queryByRole("columnheader", { name: "Sorting Filter" }),
    ).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });
});
