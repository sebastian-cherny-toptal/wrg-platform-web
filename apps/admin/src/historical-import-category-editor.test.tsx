import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryPricing } from "./api";
import { CategoryPricingEditor } from "./historical-import";

const category: CategoryPricing = {
  tier: "Small",
  zohoCategoryName: "Small",
  employeeSize: "25-99",
  priceCents: 111_000,
};

afterEach(cleanup);

function EditorHarness({
  onChange = vi.fn(),
}: {
  onChange?: (value: CategoryPricing[]) => void;
}) {
  const [editingTier, setEditingTier] = useState<
    CategoryPricing["tier"] | null
  >(null);
  const [value, setValue] = useState([category]);

  return (
    <>
      <CategoryPricingEditor
        editingTier={editingTier}
        onChange={(nextValue) => {
          setValue(nextValue);
          onChange(nextValue);
        }}
        onEditingTierChange={setEditingTier}
        value={value}
      />
      <button disabled={editingTier !== null}>Continue</button>
    </>
  );
}

describe("CategoryPricingEditor", () => {
  it("commits a category name only after the inline edit is saved", () => {
    const onChange = vi.fn();
    render(<EditorHarness onChange={onChange} />);

    expect(screen.queryByLabelText("Small Zoho category name")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Small category name" }),
    );

    const input = screen.getByLabelText("Small Zoho category name");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect((continueButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "  Small/Medium  " } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Save Small category name" }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { ...category, zohoCategoryName: "Small/Medium" },
    ]);
    expect(screen.getByText("Small/Medium")).toBeTruthy();
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not allow an empty category name to be saved", () => {
    render(<EditorHarness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Small category name" }),
    );
    fireEvent.change(screen.getByLabelText("Small Zoho category name"), {
      target: { value: "   " },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Save Small category name",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
