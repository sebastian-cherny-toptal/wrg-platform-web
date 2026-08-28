import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect } from "@wrg/platform-ui";
import { describe, expect, it, vi } from "vitest";

const options = [
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "job-level", label: "Job Level" },
];

describe("SearchableSelect", () => {
  it("filters options and selects a result", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        ariaLabel="Demographic"
        onChange={onChange}
        options={options}
        searchPlaceholder="Search demographics…"
        value=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Demographic" }));
    await user.type(screen.getByRole("searchbox", { name: "Search demographics…" }), "loc");

    expect(screen.queryByRole("option", { name: "Department" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Location" }));
    expect(onChange).toHaveBeenCalledWith("location");
  });

  it("supports keyboard navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        ariaLabel="Demographic"
        onChange={onChange}
        options={options}
        value=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "Demographic" }));
    await user.click(screen.getByRole("searchbox", { name: "Search options…" }));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("location");
  });
});
