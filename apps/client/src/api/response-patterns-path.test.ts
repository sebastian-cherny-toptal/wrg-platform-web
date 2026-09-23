import { describe, expect, it } from "vitest";
import { responsePatternsPath } from "./client";

describe("responsePatternsPath", () => {
  it("includes every selected range and authorized sample mode", () => {
    const path = responsePatternsPath(
      "program-1",
      {
        positive: [80, 100],
        neutral: [60, 79],
        negative: [10, 20],
      },
      true,
      true,
    );
    const url = new URL(path, "https://example.test");

    expect(Object.fromEntries(url.searchParams)).toEqual({
      selectedProgramId: "program-1",
      patternMode: "range",
      includePositive: "true",
      includeNeutral: "true",
      includeNegative: "true",
      positiveMin: "80",
      positiveMax: "100",
      neutralMin: "60",
      neutralMax: "79",
      negativeMin: "10",
      negativeMax: "20",
      isPreview: "true",
      isDummy: "true",
    });
  });
});
