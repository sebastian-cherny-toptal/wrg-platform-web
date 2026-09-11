import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryPricing } from "./api";
import {
  CategoryPricingEditor,
  defaultCategoryPricing,
} from "./historical-import";

const category: CategoryPricing = {
  tier: "Small",
  pricingCategoryName: "25-99",
  priceCents: 111_000,
};

afterEach(cleanup);

describe("CategoryPricingEditor", () => {
  it("leaves fallback prices blank when the backend provides no pricing", () => {
    render(
      <CategoryPricingEditor
        benchmarkCategories={["Small/Medium", "Large"]}
        onChange={vi.fn()}
        value={defaultCategoryPricing}
      />,
    );

    for (const input of screen.getAllByLabelText(/report price$/)) {
      expect((input as HTMLInputElement).value).toBe("");
    }
  });

  it("shows benchmark names separately from the fixed pricing band", () => {
    render(
      <CategoryPricingEditor
        benchmarkCategories={["Small/Medium", "Large"]}
        onChange={vi.fn()}
        value={[category]}
      />,
    );

    expect(screen.getByText("Small/Medium")).toBeTruthy();
    expect(screen.getByText("Large")).toBeTruthy();
    expect(screen.getByText("25-99")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /benchmark/u })).toBeNull();
  });

  it("allows the Zoho-backed report price to be changed", () => {
    const onChange = vi.fn();
    render(
      <CategoryPricingEditor
        benchmarkCategories={["Small/Medium", "Large"]}
        onChange={onChange}
        value={[category]}
      />,
    );

    const input = screen.getByLabelText("25-99 report price");
    expect((input as HTMLInputElement).value).toBe("1110.00");
    fireEvent.change(input, { target: { value: "1234.56" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith([
      { ...category, priceCents: 123_456 },
    ]);
  });

  it("leaves a missing Zoho price blank until the admin enters one", () => {
    render(
      <CategoryPricingEditor
        benchmarkCategories={["Small/Medium", "Large"]}
        onChange={vi.fn()}
        value={[{ ...category, priceCents: null }]}
      />,
    );

    expect(
      (screen.getByLabelText("25-99 report price") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("25-99 report price") as HTMLInputElement)
        .required,
    ).toBe(true);
  });
});
