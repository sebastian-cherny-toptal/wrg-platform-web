import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./catalog-editor";

describe("MoneyInput", () => {
  it("allows replacing the complete price before committing it", () => {
    const onChange = vi.fn();
    render(
      <MoneyInput
        ariaLabel="Report price"
        onChange={onChange}
        priceCents={50_000}
      />,
    );
    const input = screen.getByLabelText("Report price");

    fireEvent.change(input, { target: { value: "450" } });
    expect((input as HTMLInputElement).value).toBe("450");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(45_000);
    expect((input as HTMLInputElement).value).toBe("450.00");
  });
});
