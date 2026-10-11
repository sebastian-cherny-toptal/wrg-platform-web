import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BenefitsBenchmarkTable } from "./benefits-benchmark-table";

describe("BenefitsBenchmarkTable", () => {
  it("keeps matrix item headings with their ordinal response percentages", async () => {
    render(
      <BenefitsBenchmarkTable
        headers={[{ title: "All", type: "All_Yes" }]}
        questions={[
          {
            title: "Supplementary benefits",
            nestedData: [
              {
                title: "Standard Offering",
                groupLabel: "Life Assurance",
                type: "%",
                dataValues: [63],
              },
              {
                title: "Not Offered",
                groupLabel: "Life Assurance",
                type: "%",
                dataValues: [37],
              },
              {
                title: "Standard Offering",
                groupLabel: "Health Cash Plan",
                type: "%",
                dataValues: [31],
              },
            ],
          },
        ]}
      />,
    );
    const button = screen.getAllByRole("button", {
      name: "Supplementary benefits",
    })[0];
    if (!button) throw new Error("Matrix disclosure was not rendered");
    await userEvent.click(button);
    expect(
      screen.getAllByRole("heading", { name: "Life Assurance" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("heading", { name: "Health Cash Plan" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("63%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31%").length).toBeGreaterThan(0);
  });
  it("reveals workbook percentages when a question is expanded", async () => {
    const user = userEvent.setup();
    render(
      <BenefitsBenchmarkTable
        headers={[
          {
            title: "All Size Categories",
            subTitle: "Winners",
            type: "All_Yes",
          },
          {
            title: "All Size Categories",
            subTitle: "Non-Winners",
            type: "All_No",
          },
        ]}
        questions={[
          {
            id: "question-1",
            title: "Does your organization recognize milestones?",
            nestedData: [
              { title: "Yes", type: "%", dataValues: [86, 42] },
              { title: "No", type: "%", dataValues: [14, 58] },
            ],
          },
        ]}
      />,
    );

    const button = screen.getAllByRole("button", {
      name: "Does your organization recognize milestones?",
    })[0];
    expect(button).toBeDefined();
    if (!button) throw new Error("Question disclosure was not rendered");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("86%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42%").length).toBeGreaterThan(0);
    expect(screen.queryByText("14%")).not.toBeInTheDocument();
  });
});
