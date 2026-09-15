import { describe, expect, it } from "vitest";
import {
  bulkUserColumns,
  parseCsv,
  resolveBulkUser,
  spreadsheetRows,
} from "./bulk-users";
import type { ProjectRecord, OrganizationRecord } from "./api";

const roles = [
  { _id: "admin", name: "Admin", role: "admin" },
  { _id: "client", name: "Client", role: "client" },
];
const project = (id: string, name: string): ProjectRecord => ({
  id,
  name,
  createdAt: null,
  programs: [],
});
const row = (values: string[]) => spreadsheetRows([bulkUserColumns, values])[0];

describe("bulk user spreadsheet validation", () => {
  it("reads quoted CSV, BOM headers, reordered columns and skips blank rows", () => {
    const data = parseCsv(
      '\uFEFFEmail,Full Name,Role,Username\r\na@example.com,"Alex, \"\"A\"\"",Admin,alex\r\n,,,\r\n',
    );
    const rows = spreadsheetRows(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].input["Full Name"]).toBe('Alex, "A"');
    expect(rows[0].rowNumber).toBe(2);
    expect(() => parseCsv('"unclosed')).toThrow("unclosed");
    expect(() => spreadsheetRows([["Email"]])).toThrow("Full Name");
  });
  it("matches names case insensitively, flags missing projects, and requires an explicit ambiguous selection", () => {
    const input = row([
      "Alex",
      "a@example.com",
      "alex",
      "ADMIN",
      " workforce ",
    ]);
    const projects = [project("p1", "Workforce"), project("p2", "WORKFORCE")];
    expect(
      resolveBulkUser(input, roles, projects, [], [input], []).errors,
    ).toContain("Project: select one of 2 matches.");
    input.selected.Project = "p2";
    expect(
      resolveBulkUser(input, roles, projects, [], [input], []).errors,
    ).toEqual([]);
    input.input.Project = "Unknown";
    expect(
      resolveBulkUser(input, roles, projects, [], [input], []).errors.join(" "),
    ).toContain("no match");
  });
  it("restricts client programs to the selected organization and project", () => {
    const input = row([
      "Alex",
      "a@example.com",
      "alex",
      "CLIENT",
      "Workforce",
      "Awards",
      "Acme",
    ]);
    const organization: OrganizationRecord = {
      id: "o1",
      selectionId: "o1",
      name: "ACME",
      programs: [
        {
          id: "a1",
          name: "AWARDS",
          year: 2026,
          projectId: "p1",
          projectName: "Workforce",
        },
      ],
      users: [],
      sourceId: "o1",
      sourceName: null,
      createdAt: null,
      stage: null,
      lastSyncedAt: null,
      surveysSent: 0,
      isWinner: null,
      isIncluded: true,
      companySize: null,
      employeesCount: null,
      overallRank: null,
      categoryRank: null,
      currentZohoCategory: null,
      reportCategory: null,
      benchmarkCategory: null,
      organizationProgramId: "e1",
    };
    const result = resolveBulkUser(
      input,
      roles,
      [project("p1", "Workforce")],
      [organization],
      [input],
      [],
    );
    expect(result.errors).toEqual([]);
    expect(result.selected.Program).toBe("a1");
    organization.programs[0].projectId = "p2";
    expect(
      resolveBulkUser(
        input,
        roles,
        [project("p1", "Workforce")],
        [organization],
        [input],
        [],
      ).errors.join(" "),
    ).toContain("Program: no match");
  });
  it("rejects duplicate identities and programs for non-client roles", () => {
    const a = row(["Alex", "a@example.com", "alex", "Admin", "", "Awards"]);
    const b = row(["Other", "A@example.com", "ALEX", "Admin"]);
    const errors = resolveBulkUser(a, roles, [], [], [a, b], []).errors.join(
      " ",
    );
    expect(errors).toContain("Email already exists");
    expect(errors).toContain("Username already exists");
    expect(errors).toContain("only supported for Client");
  });
});
