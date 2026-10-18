import { describe, expect, it } from "vitest";
import { pairedWorkforceCohorts, workforceCohorts } from "./workforce-cohorts";

const header = (title: string, type: string) => ({ title, type, color: "#000" });

describe("workforce cohort ordering", () => {
  it("orders Super Employers after Major and preserves benchmark value indexes", () => {
    const headers = ["All Size Categories", "Small", "Super", "Medium", "Large", "Major"]
      .flatMap((size) => {
        const title = size === "All Size Categories" ? size : `${size} Employers`;
        const key = size === "All Size Categories" ? "All" : size;
        return [header(title, `${key}_Yes`), header(title, `${key}_No`)];
      });

    expect(pairedWorkforceCohorts(headers)).toEqual([
      { label: "All Size Categories", winnerIndex: 0, nonWinnerIndex: 1 },
      { label: "Small Employers", winnerIndex: 2, nonWinnerIndex: 3 },
      { label: "Medium Employers", winnerIndex: 6, nonWinnerIndex: 7 },
      { label: "Large Employers", winnerIndex: 8, nonWinnerIndex: 9 },
      { label: "Major Employers", winnerIndex: 10, nonWinnerIndex: 11 },
      { label: "Super Employers", winnerIndex: 4, nonWinnerIndex: 5 },
    ]);
  });

  it("uses Zoho size order for winners, non-winners, and paired benchmark data", () => {
    const headers = [
      header("Boutique Employers", "Boutique_Yes"),
      header("Boutique Non-Winners", "Boutique_No"),
      header("Small Employers", "Small_Yes"),
      header("Small Non-Winners", "Small_No"),
      header("Medium Employers", "Medium_Yes"),
      header("Medium Non-Winners", "Medium_No"),
      header("Large Employers", "Large_Yes"),
      header("Large Non-Winners", "Large_No"),
      header("Major Employers", "Major_Yes"),
      header("Major Non-Winners", "Major_No"),
      header("Mega Employers", "Mega_Yes"),
      header("Mega Non-Winners", "Mega_No"),
      header("Small-Medium Employers", "Super_Yes"),
      header("Small-Medium Non-Winners", "Super_No"),
    ];

    const cohorts = workforceCohorts(headers);
    expect(cohorts.filter(({ kind }) => kind === "winner").map(({ label }) => label)).toEqual([
      "Boutique Employers",
      "Small Employers",
      "Small-Medium Employers",
      "Medium Employers",
      "Large Employers",
      "Mega Employers",
      "Major Employers",
    ]);
    expect(cohorts.filter(({ kind }) => kind === "nonWinner").map(({ label }) => label)).toEqual([
      "Boutique Non-Winners",
      "Small Non-Winners",
      "Small-Medium Non-Winners",
      "Medium Non-Winners",
      "Large Non-Winners",
      "Mega Non-Winners",
      "Major Non-Winners",
    ]);
    expect(pairedWorkforceCohorts(headers).map(({ label }) => label)).toEqual([
      "Boutique Employers",
      "Small Employers",
      "Small-Medium Employers",
      "Medium Employers",
      "Large Employers",
      "Mega Employers",
      "Major Employers",
    ]);
  });

  it("includes configured employee-size ranges in FDD cohort labels", () => {
    const headers = [
      header("All Size Categories", "All_Yes"),
      header("All Size Categories", "All_No"),
      { ...header("Boutique Employers", "Boutique_Yes"), employeeSize: "15-34 UK" },
      { ...header("Boutique Employers", "Boutique_No"), employeeSize: "15-34 UK" },
    ];

    expect(pairedWorkforceCohorts(headers).map(({ label }) => label)).toEqual([
      "All Size Categories",
      "Boutique Employers (15-34 UK Employees)",
    ]);
  });
});
