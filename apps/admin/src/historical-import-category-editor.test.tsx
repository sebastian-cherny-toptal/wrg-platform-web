import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryPricing } from "./api";
import { CategoryPricingEditor } from "./historical-import";

const category: CategoryPricing = {
  tier: "Small",
  zohoCategoryName: "Small-Medium",
  employeeSize: "35-74 US",
  priceCents: 111_000,
};

afterEach(cleanup);

describe("CategoryPricingEditor", () => {
  it("shows the Zoho name and range as read-only values", () => {
    render(<CategoryPricingEditor onChange={vi.fn()} value={[category]} />);

    expect(screen.getByText("Small-Medium")).toBeTruthy();
    expect(screen.getByText("35-74 US")).toBeTruthy();
    expect(screen.queryByLabelText("Small Zoho category name")).toBeNull();
    expect(screen.queryByLabelText("Small category size")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit Small category name" }),
    ).toBeNull();
  });

  it("allows the Zoho-backed report price to be changed", () => {
    const onChange = vi.fn();
    render(<CategoryPricingEditor onChange={onChange} value={[category]} />);

    const input = screen.getByLabelText("Small category price");
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
        onChange={vi.fn()}
        value={[{ ...category, priceCents: null }]}
      />,
    );

    expect(
      (screen.getByLabelText("Small category price") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Small category price") as HTMLInputElement)
        .required,
    ).toBe(true);
  });
});
