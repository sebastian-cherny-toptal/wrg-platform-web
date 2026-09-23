import { describe, expect, it } from "vitest";
import {
  bulkUsersCsv,
  bulkUserColumns,
  parseCsv,
  resolveBulkUser,
  spreadsheetRows,
} from "./bulk-users";
import type { ProjectRecord, OrganizationRecord, UserRecord } from "./api";

const roles = [
  { _id: "admin", name: "Admin", role: "admin" },
  { _id: "client", name: "Client", role: "client" },
  { _id: "promotional", name: "Promotional", role: "promotional" },
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
  it("matches client programs from the selected Project independently of organization Program data", () => {
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
      purchasedEvSortingFilter: null,
      organizationProgramId: "e1",
    };
    const workforce = project("p1", "Workforce");
    workforce.programs = [
      {
        id: "a1",
        name: "AWARDS",
        year: 2026,
        createdAt: null,
        organizationCount: 1,
        winnersCount: 0,
        categorySummaries: [],
        latestZohoSync: null,
      },
    ];
    const result = resolveBulkUser(
      input,
      roles,
      [workforce],
      [organization],
      [input],
      [],
    );
    expect(result.errors).toEqual([]);
    expect(result.selected.Program).toBe("a1");
    organization.programs = [];
    expect(
      resolveBulkUser(input, roles, [workforce], [organization], [input], [])
        .selected.Program,
    ).toBe("a1");
  });
  it("resolves every comma-separated Program and rejects partial matches", () => {
    const input = row([
      "Alex",
      "a@example.com",
      "alex",
      "Client",
      "Workforce",
      "Awards 2025, Awards 2026",
      "Acme",
    ]);
    const workforce = project("p1", "Workforce");
    workforce.programs = ["2025", "2026"].map((year) => ({
      id: `program-${year}`,
      name: `Awards ${year}`,
      year: Number(year),
      createdAt: null,
      organizationCount: 1,
      winnersCount: 0,
      categorySummaries: [],
      latestZohoSync: null,
    }));
    const organization = {
      id: "org-1",
      selectionId: "org-1",
      name: "Acme",
      programs: workforce.programs.map((program) => ({
        id: program.id,
        name: program.name,
        year: program.year,
        projectId: "p1",
        projectName: "Workforce",
      })),
      users: [],
    } as unknown as OrganizationRecord;
    const resolved = resolveBulkUser(
      input,
      roles,
      [workforce],
      [organization],
      [input],
      [],
    );
    expect(resolved.errors).toEqual([]);
    expect(resolved.programIds).toEqual(["program-2025", "program-2026"]);
    input.input.Program = "Awards 2025, Missing";
    expect(
      resolveBulkUser(
        input,
        roles,
        [workforce],
        [organization],
        [input],
        [],
      ).errors.join(" "),
    ).toContain("no match for “Missing”");
  });

  it("groups duplicate organization matches when their programs cover every assignment", () => {
    const input = row([
      "Alex",
      "a@example.com",
      "alex",
      "Client",
      "Workforce",
      "Awards 2025, Awards 2026",
      "Artemis",
    ]);
    const workforce = project("p1", "Workforce");
    workforce.programs = [2025, 2026].map((year) => ({
      id: `program-${year}`,
      name: `Awards ${year}`,
      year,
      createdAt: null,
      organizationCount: 2,
      winnersCount: 0,
      categorySummaries: [],
      latestZohoSync: null,
    }));
    const organizations = [
      ["enrollment-2025-a", "program-2025"],
      ["enrollment-2025-b", "program-2025"],
      ["enrollment-2026-a", "program-2026"],
      ["enrollment-2026-b", "program-2026"],
    ].map(([selectionId, programId]) => {
      const organization = {
        id: selectionId,
        selectionId,
        name: "Artemis",
        programs: [
          {
            id: programId,
            name: programId,
            year: Number(programId.slice(-4)),
            projectId: "p1",
            projectName: "Workforce",
            organizationProgramId: selectionId,
          },
        ],
        users: [],
      };
      return organization as unknown as OrganizationRecord;
    });

    const resolved = resolveBulkUser(
      input,
      roles,
      [workforce],
      organizations,
      [input],
      [],
    );
    expect(resolved.errors).toEqual([]);
    expect(resolved.selected.Organization).toBe("enrollment-2025-a");
    expect(resolved.programIds).toEqual(["program-2025", "program-2026"]);

    for (const organization of organizations) {
      organization.programs = organization.programs.filter(
        (program) => program.id !== "program-2026",
      );
    }
    expect(
      resolveBulkUser(
        input,
        roles,
        [workforce],
        organizations,
        [input],
        [],
      ).errors.join(" "),
    ).toContain("Organization: no match for “Artemis”");
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

  it("does not require Organization or Program for promotional users", () => {
    const input = row([
      "Promo User",
      "promo@example.com",
      "promo",
      "Promotional",
    ]);
    const resolved = resolveBulkUser(input, roles, [], [], [input], []);
    expect(resolved.errors).toEqual([]);
    expect(resolved.isClient).toBe(false);
  });

  it("treats a matching username as an update but preserves other identity conflicts", () => {
    const input = row(["Alex Updated", "alex@example.com", "ALEX", "Admin"]);
    const existing = {
      id: "user-1",
      fullName: "Alex",
      email: "alex@example.com",
      username: "alex",
      mobile: null,
      role: "admin",
      roleId: "admin",
      organization: null,
      projects: [],
      programDetails: [],
      createdAt: null,
      lastLogin: null,
      status: "ACTIVE",
      payments: [],
      totalPaid: [],
      lastPaymentDatetime: null,
    } satisfies UserRecord;
    const resolved = resolveBulkUser(input, roles, [], [], [input], [existing]);
    expect(resolved.existingUser?.id).toBe("user-1");
    expect(resolved.errors).toEqual([]);
    const other = {
      ...existing,
      id: "user-2",
      username: "other",
      email: "other@example.com",
    };
    expect(
      resolveBulkUser(input, roles, [], [], [input], [existing, other]).errors,
    ).toEqual([]);
    other.email = "alex@example.com";
    expect(
      resolveBulkUser(
        input,
        roles,
        [],
        [],
        [input],
        [existing, other],
      ).errors.join(" "),
    ).toContain("Email already exists");
  });

  it("exports all Bulk Creation columns with safe multi-value CSV cells", () => {
    const csv = bulkUsersCsv([
      {
        id: "user-1",
        fullName: "=Alex, Example",
        email: "alex@example.com",
        username: "alex",
        mobile: "123",
        role: "client",
        roleId: "client",
        organization: { id: "org-1", name: 'Acme "North"' },
        projects: [
          { id: "project-1", name: "Workforce" },
          { id: "project-2", name: "Benefits" },
        ],
        programDetails: [
          { id: "program-1", name: "Awards 2025", year: 2025 },
          { id: "program-2", name: "Awards 2026", year: 2026 },
        ],
        createdAt: null,
        lastLogin: null,
        status: "ACTIVE",
        payments: [],
        totalPaid: [],
        lastPaymentDatetime: null,
      },
    ]);
    const parsed = parseCsv(csv);
    expect(parsed[0]?.map((value) => value.replace(/^\uFEFF/u, ""))).toEqual([
      ...bulkUserColumns,
    ]);
    expect(parsed[1]).toEqual([
      "'=Alex, Example",
      "alex@example.com",
      "alex",
      "client",
      "Workforce, Benefits",
      "Awards 2025, Awards 2026",
      'Acme "North"',
      "123",
    ]);
  });
});
