import { describe, expect, it } from "vitest";
import type { OrganizationRecord } from "./api";
import {
  filterAndSortOrganizations,
  mergeOrganizations,
} from "./organization-options";

function organization(id: string, name: string): OrganizationRecord {
  return {
    id,
    selectionId: id,
    sourceId: id,
    sourceName: null,
    name,
    createdAt: null,
    stage: null,
    lastSyncedAt: null,
    surveysSent: 0,
    companySize: null,
    organizationProgramId: "",
    isWinner: false,
    isIncluded: true,
    benefitsBestPracticesFileName: null,
    programs: [],
    users: [],
  };
}

describe("organization options", () => {
  const organizations = [
    organization("3", "Zulu Health"),
    organization("1", "alpha Group"),
    organization("2", "Beta Works"),
  ];

  it("sorts organization names alphabetically without mutating the source", () => {
    expect(
      filterAndSortOrganizations(organizations, "").map(({ id }) => id),
    ).toEqual(["1", "2", "3"]);
    expect(organizations.map(({ id }) => id)).toEqual(["3", "1", "2"]);
  });

  it("filters organization names case-insensitively", () => {
    expect(
      filterAndSortOrganizations(organizations, "  WORK  ").map(({ id }) => id),
    ).toEqual(["2"]);
  });

  it("merges programs belonging to the same source organization", () => {
    const first = organization("database-1", "Example Company");
    first.sourceId = "source-19";
    first.programs = [
      {
        id: "program-1",
        name: "2025",
        year: 2025,
        projectId: "project-1",
        projectName: "Project 1",
      },
    ];
    const second = organization("database-2", "Example Company");
    second.sourceId = "source-19";
    second.programs = [
      {
        id: "program-2",
        name: "2026",
        year: 2026,
        projectId: "project-2",
        projectName: "Project 2",
      },
    ];

    const result = mergeOrganizations([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0]?.programs.map(({ id }) => id)).toEqual([
      "program-1",
      "program-2",
    ]);
  });

  it("does not merge program-local source IDs belonging to different companies", () => {
    const first = organization("database-1", "AccuTemp Services");
    first.sourceId = "3";
    const second = organization("database-2", "Advanced Office Systems");
    second.sourceId = "3";

    expect(mergeOrganizations([first, second]).map(({ name }) => name)).toEqual(
      ["AccuTemp Services", "Advanced Office Systems"],
    );
  });
});
