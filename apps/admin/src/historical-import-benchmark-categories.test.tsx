import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryPricing } from "./api";
import { WinnersStep } from "./historical-import";

afterEach(cleanup);

const categoryPricing: CategoryPricing[] = [
  ["Boutique", "Boutique", "15-24"],
  ["Small", "Small/Medium", "25-99"],
  ["Medium", "Medium", "100-199"],
  ["Large", "Large", "200-499"],
  ["Mega", "Mega", "500-999"],
  ["Major", "Major", "1,000+"],
].map(([tier, zohoCategoryName, employeeSize]) => ({
  tier: tier as CategoryPricing["tier"],
  zohoCategoryName,
  employeeSize,
  priceCents: 100,
}));

describe("WinnersStep benchmark category choices", () => {
  it("uses the program's Zoho category names for the radio buttons", () => {
    render(
      <WinnersStep
        draft={{
          importId: "import-id",
          metadata: {
            programName: "Indiana 2026",
            categoryPricing,
            organizationPrograms: [
              {
                organizationKey: "organization-1",
                organizationName: "Acme",
                surveysSent: 20,
                isWinner: true,
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
  });
});
