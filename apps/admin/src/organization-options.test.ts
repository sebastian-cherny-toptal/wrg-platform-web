import { describe, expect, it } from "vitest";
import type { OrganizationRecord } from "./api";
import { filterAndSortOrganizations } from "./organization-options";

function organization(id: string, name: string): OrganizationRecord {
  return {
    id,
    sourceId: id,
    sourceName: null,
    name,
    createdAt: null,
    stage: null,
    lastSyncedAt: null,
    surveysSent: 0,
    organizationProgramId: "",
    isWinner: false,
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
    expect(filterAndSortOrganizations(organizations, "").map(({ id }) => id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(organizations.map(({ id }) => id)).toEqual(["3", "1", "2"]);
  });

  it("filters organization names case-insensitively", () => {
    expect(
      filterAndSortOrganizations(organizations, "  WORK  ").map(({ id }) => id),
    ).toEqual(["2"]);
  });
});
