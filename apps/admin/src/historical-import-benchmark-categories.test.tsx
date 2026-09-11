import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryPricing } from "./api";
import { WinnersStep } from "./historical-import";

afterEach(cleanup);

const categoryPricing: CategoryPricing[] = [
  ["Boutique", "15-24"],
  ["Small", "25-99"],
  ["Medium", "100-199"],
  ["Large", "200-499"],
  ["Mega", "500-999"],
  ["Major", "1000+"],
].map(([tier, pricingCategoryName]) => ({
  tier: tier as CategoryPricing["tier"],
  pricingCategoryName,
  priceCents: 100,
}));

describe("WinnersStep benchmark category choices", () => {
  it("uses the program's Zoho category names for the radio buttons", () => {
    render(
      <WinnersStep
        draft={{
          metadata: {
            programName: "Indiana 2026",
            benchmarkCategories: ["Small/Medium", "Large"],
            categoryPricing,
            organizationPrograms: [
              {
                organizationKey: "organization-1",
                organizationName: "Acme",
                surveysSent: 20,
                isWinner: "Y",
                isIncluded: true,
                currentZohoCategory: "Small/Medium",
                reportCategory: "25-99",
                benchmarkCategory: "Super",
              },
            ],
          },
        }}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const editedCategory = screen.getByRole("radio", {
      name: "Small/Medium",
    }) as HTMLInputElement;
    expect(editedCategory.checked).toBe(true);
    expect(screen.queryByRole("radio", { name: "Small" })).toBeNull();
    const organizationRow = screen.getByRole("row", { name: /Acme/u });
    expect(within(organizationRow).getAllByRole("cell")[4]?.textContent).toBe(
      "25-99",
    );
    const winner = within(organizationRow).getByRole("combobox", {
      name: "Winner for Acme",
    }) as HTMLSelectElement;
    expect(winner.value).toBe("Y");
    expect(
      within(winner)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["-", "Y", "N"]);
    fireEvent.change(winner, { target: { value: "" } });
    expect(winner.value).toBe("");

    const summary = screen.getByLabelText("Organization summary");
    expect(within(summary).getAllByText("Non-winners")).toHaveLength(2);
  });
});
