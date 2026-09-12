import { describe, expect, it } from "vitest";
import { pairedWorkforceCohorts, workforceCohorts } from "./workforce-cohorts";

const header = (title: string, type: string) => ({ title, type, color: "#000" });

describe("workforce cohort ordering", () => {
  it("uses Zoho size order for winners, non-winners, and paired benchmark data", () => {
    const headers = [
      header("Small Employers", "Small_Yes"),
      header("Small Non-Winners", "Small_No"),
      header("Medium Employers", "Medium_Yes"),
      header("Medium Non-Winners", "Medium_No"),
      header("Large Employers", "Large_Yes"),
      header("Large Non-Winners", "Large_No"),
      header("Major Employers", "Major_Yes"),
      header("Major Non-Winners", "Major_No"),
      header("Small-Medium Employers", "Super_Yes"),
      header("Small-Medium Non-Winners", "Super_No"),
    ];

    const cohorts = workforceCohorts(headers);
    expect(cohorts.filter(({ kind }) => kind === "winner").map(({ label }) => label)).toEqual([
      "Small Employers",
      "Small-Medium Employers",
      "Medium Employers",
      "Large Employers",
      "Major Employers",
    ]);
    expect(cohorts.filter(({ kind }) => kind === "nonWinner").map(({ label }) => label)).toEqual([
      "Small Non-Winners",
      "Small-Medium Non-Winners",
      "Medium Non-Winners",
      "Large Non-Winners",
      "Major Non-Winners",
    ]);
    expect(pairedWorkforceCohorts(headers).map(({ label }) => label)).toEqual([
      "Small Employers",
      "Small-Medium Employers",
      "Medium Employers",
      "Large Employers",
      "Major Employers",
    ]);
  });
});
