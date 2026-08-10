import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailedResultsFilters } from "./client-reports";

const filters = [
  {
    questionId: "department-question",
    label: "Department",
    options: [
      { label: "Finance", values: ["Finance"] },
      { label: "Human Resources", values: ["Human Resources"] },
    ],
  },
  {
    questionId: "gender-question",
    label: "Gender",
    options: [{ label: "Female", values: ["Female"] }],
  },
];

describe("detailed-results filters", () => {
  const desktopWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: desktopWidth,
    });
    window.dispatchEvent(new Event("resize"));
  });

  it("shows categories, supports multi-select values, and reports the count", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <DetailedResultsFilters
        filters={filters}
        loading={false}
        onToggle={onToggle}
        selectedFilters={[
          {
            questionId: "department-question",
            label: "Finance",
            values: ["Finance"],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    expect(
      screen.getByText("Select a category to view filters"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Department" }));
    expect(
      screen.getByRole("button", { name: "Finance" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getByRole("button", { name: "Human Resources" }),
    );
    expect(onToggle).toHaveBeenCalledWith({
      questionId: "department-question",
      label: "Human Resources",
      values: ["Human Resources"],
    });
  });

  it("closes when the user clicks outside the selector", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DetailedResultsFilters
          filters={filters}
          loading={false}
          onToggle={vi.fn()}
          selectedFilters={[]}
        />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(
      screen.getByRole("dialog", { name: "Detailed results filters" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(
      screen.queryByRole("dialog", { name: "Detailed results filters" }),
    ).not.toBeInTheDocument();
  });

  it("uses the deployed full-screen accordion selector on mobile", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 640,
    });
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <DetailedResultsFilters
        filters={filters}
        loading={false}
        onToggle={onToggle}
        selectedFilters={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", {
      name: "Detailed results filters",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await user.click(screen.getByRole("button", { name: "Department" }));
    await user.click(screen.getByRole("button", { name: "Finance" }));
    expect(onToggle).toHaveBeenCalledWith({
      questionId: "department-question",
      label: "Finance",
      values: ["Finance"],
    });

    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(dialog).not.toBeInTheDocument();
  });
});
