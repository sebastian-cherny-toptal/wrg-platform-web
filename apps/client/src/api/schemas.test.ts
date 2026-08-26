import { describe, expect, it } from "vitest";
import {
  employeeResponseBreakdownBySectionSchema,
  keyImpactAnalysisSchema,
} from "./schemas";

describe("employee response breakdown by section schema", () => {
  it("accepts fractional percentages returned by the reports API", () => {
    const result = employeeResponseBreakdownBySectionSchema.safeParse({
      success: true,
      message: "success",
      isConfidential: false,
      data: [
        {
          "Core Employee Experience": [
            {
              ResponseCaption: "Agree",
              numberOfResponses: 1,
              percentOfAgreement: 1 / 3,
              colorCode: "#7c3aed",
              percent: 1 / 3,
              percentage: 100 / 3,
            },
            {
              ResponseCaption: "Neutral",
              numberOfResponses: 2,
              colorCode: "#f59e0b",
              percent: 2 / 3,
              percentage: 200 / 3,
            },
            {
              ResponseCaption: "Disagree",
              numberOfResponses: 0,
              colorCode: "#dc2626",
              percent: 0,
              percentage: 0,
            },
            {
              totalNumberOfQuestionsPerSection: 1,
              totalNumberOfResponsePerSection: 3,
              totalRespondents: 3,
              questionRange: ["question-1"],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("key impact analysis schema", () => {
  it("accepts a question-to-contribution mapping", () => {
    const result = keyImpactAnalysisSchema.safeParse({
      success: true,
      message: "success",
      data: {
        mapping: {
          "I understand how my work impacts organizational success": 15.49,
        },
        report: [
          {
            label: "Your Job",
            key: "I understand how my work impacts organizational success",
            value: 0.1549,
          },
        ],
        data: { signedUrl: null },
      },
    });

    expect(result.success).toBe(true);
  });
});
