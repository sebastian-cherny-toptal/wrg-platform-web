import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramDetailPage } from "./admin";
import { api, persistAuth } from "./api";
import { AuthProvider } from "./auth";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("program configuration", () => {
  it("edits category prices and the program store from tabs", async () => {
    persistAuth({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "admin-id",
        displayName: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });
    vi.spyOn(api, "program").mockResolvedValue({
      id: "program-id",
      name: "Program 2026",
      year: 2026,
      createdAt: null,
      organizationCount: 0,
      winnersCount: 0,
      categorySummaries: [],
      latestZohoSync: null,
      details: {
        categoryPricing: [
          {
            tier: "Boutique",
            pricingCategoryName: "15-24",
            priceCents: null,
          },
          {
            tier: "Small",
            pricingCategoryName: "25-99",
            priceCents: 120_000,
          },
        ],
      },
    });
    vi.spyOn(api, "organizations").mockResolvedValue([]);
    const product = {
      id: "report-standard-package",
      name: "Feedback Dashboard",
      description: "Standard reports and dashboard.",
      priceCents: 100_000,
      available: true,
    };
    vi.spyOn(api, "reportProductTemplates").mockResolvedValue([product]);
    vi.spyOn(api, "programCatalog").mockResolvedValue([product]);
    const saveCategories = vi
      .spyOn(api, "saveProgramCategoryPrices")
      .mockImplementation(async (_programId, categories) => categories);
    const saveStore = vi
      .spyOn(api, "saveProgramCatalog")
      .mockImplementation(async (_programId, products) => products);

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={["/admin/projects/project-id/programs/program-id"]}
        >
          <Routes>
            <Route
              path="/admin/projects/:projectId/programs/:programId"
              element={<ProgramDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("tab", { name: "Report pricing" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Program Details" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Report pricing" }));
    expect(
      screen.getByRole("tab", { name: "Report pricing" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByText("15-24")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter a price for every category.")).toBeTruthy();
    const categoryPrice = screen.getByLabelText("15-24 report price");
    fireEvent.change(categoryPrice, { target: { value: "1100" } });
    fireEvent.blur(categoryPrice);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(saveCategories).toHaveBeenCalledWith(
        "program-id",
        expect.arrayContaining([
          expect.objectContaining({ tier: "Boutique", priceCents: 110_000 }),
        ]),
      ),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Store" }));
    const productName = await screen.findByLabelText("Product name");
    fireEvent.change(productName, { target: { value: "Updated Dashboard" } });
    const storePrice = screen.getByLabelText("Updated Dashboard price");
    fireEvent.change(storePrice, { target: { value: "1250" } });
    fireEvent.blur(storePrice);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(saveStore).toHaveBeenCalledWith("program-id", [
        expect.objectContaining({
          name: "Updated Dashboard",
          priceCents: 125_000,
        }),
      ]),
    );
  });
});
