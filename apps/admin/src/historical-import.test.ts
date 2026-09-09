import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import {
  applyZohoOrganizations,
  filterAndSortProjects,
  filterWinnerOrganizations,
  newProgramProjectPayload,
  organizationParticipationStatus,
  summarizeOrganizationPrograms,
} from "./historical-import";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("winner organization filtering", () => {
  const organizations = [
    {
      organizationKey: "org1",
      organizationName: "Alpha Company",
      surveysSent: 0,
      isWinner: "N" as const,
      isIncluded: true,
      currentZohoCategory: "Super",
    },
    {
      organizationKey: "org2",
      organizationName: "Beta Company",
      surveysSent: 0,
      isWinner: "N" as const,
      isIncluded: true,
    },
    {
      organizationKey: "org5",
      organizationName: "Fifth Group",
      surveysSent: 0,
      isWinner: "N" as const,
      isIncluded: true,
    },
  ];

  it("matches comma-separated names or IDs in the entered order", () => {
    expect(filterWinnerOrganizations(organizations, "org5, alpha")).toEqual([
      organizations[2],
      organizations[0],
    ]);
  });

  it("applies all program-scoped Zoho organization fields and splits deal names", () => {
    expect(
      applyZohoOrganizations(organizations.slice(0, 2), [
        {
          organizationId: "460737994",
          organizationName:
            "Alpha Company-460737994-Best Places to Work in Baton Rouge 2026",
          isWinner: "Y",
          surveysSent: 125,
          stage: "Qualified",
          companySize: 30,
          employeesCount: 125,
          currentZohoCategory: "Small/Medium",
          reportCategory: "25-99",
          overallRank: "4",
          categoryRank: "2",
        },
        {
          organizationId: "952037468",
          organizationName:
            "Beta Company-952037468-Best Places to Work in Baton Rouge 2026",
          isWinner: "N",
          surveysSent: 80,
          stage: null,
          companySize: null,
          employeesCount: null,
          currentZohoCategory: "Small",
          reportCategory: "100-199",
          overallRank: null,
          categoryRank: null,
        },
      ]),
    ).toMatchObject([
      {
        isWinner: "Y",
        surveysSent: 125,
        stage: "Qualified",
        companySize: 30,
        employeesCount: 125,
        currentZohoCategory: "Small/Medium",
        reportCategory: "25-99",
        overallRank: "4",
        categoryRank: "2",
      },
      {
        isWinner: "N",
        surveysSent: 80,
        currentZohoCategory: "Small",
        reportCategory: "100-199",
      },
    ]);
  });
});

describe("organization participation status", () => {
  const organization = (
    isWinner: "Y" | "N",
    isIncluded: boolean,
    currentZohoCategory = "Small",
  ) => ({
    organizationKey: `${isWinner}-${isIncluded}-${currentZohoCategory}`,
    organizationName: "Example",
    surveysSent: 10,
    isWinner,
    isIncluded,
    currentZohoCategory,
  });

  it("distinguishes winners, non-winners, and not-included organizations", () => {
    expect(organizationParticipationStatus(organization("Y", true))).toBe(
      "winner",
    );
    expect(organizationParticipationStatus(organization("N", true))).toBe(
      "non-winner",
    );
    expect(organizationParticipationStatus(organization("Y", false))).toBe(
      "not-included",
    );
  });

  it("counts only included organizations in category totals", () => {
    const summary = summarizeOrganizationPrograms([
      organization("Y", true),
      organization("N", true),
      organization("N", false),
      organization("Y", true, "Medium"),
    ]);

    expect(summary.notIncluded).toBe(1);
    expect(summary.categories).toContainEqual({
      category: "Small",
      winners: 1,
      nonWinners: 1,
      total: 2,
    });
    expect(summary.categories).toContainEqual({
      category: "Medium",
      winners: 1,
      nonWinners: 0,
      total: 1,
    });
  });
});

describe("project options", () => {
  const project = (id: string, name: string) => ({
    id,
    name,
    createdAt: null,
    programs: [],
  });

  it("filters by a case-insensitive substring and sorts alphabetically", () => {
    expect(
      filterAndSortProjects(
        [
          project("3", "Zeta Health"),
          project("2", "beta Health"),
          project("1", "Alpha Group"),
        ],
        "HEALTH",
      ).map(({ name }) => name),
    ).toEqual(["beta Health", "Zeta Health"]);
  });

  it("sends a Zoho selection as zohoProjectId instead of a local projectId", () => {
    expect(
      newProgramProjectPayload({
        id: "4876876000000123456",
        externalId: "4876876000000123456",
        name: "Baton Rouge",
        abbreviation: "BR",
        createdAt: null,
        programs: [],
      }),
    ).toEqual({
      projectId: null,
      zohoProjectId: "4876876000000123456",
      projectName: "Baton Rouge",
      projectAbbreviation: "BR",
    });
  });
});

describe("historical import API client", () => {
  it("loads and projects Zoho program options", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: [
            {
              id: "zoho-program-1",
              name: "Baton Rouge 2026",
              year: 2026,
              projectId: "zoho-project-1",
              projectName: "Baton Rouge",
              projectAbbreviation: "BR",
              efsLaunchDate: "2026-01-15",
              efsDeadline: "2026-04-30",
              winnerOrganizations: [],
              organizations: [],
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.zohoPrograms("zoho-project-1")).resolves.toEqual([
      {
        id: "zoho-program-1",
        name: "Baton Rouge 2026",
        year: 2026,
        projectId: "zoho-project-1",
        projectName: "Baton Rouge",
        projectAbbreviation: "BR",
        efsLaunchDate: "2026-01-15",
        efsDeadline: "2026-04-30",
        winnerOrganizations: [],
        organizations: [],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/zoho/projects/zoho-project-1/programs"),
      expect.any(Object),
    );
  });

  it("creates a draft with project metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            importId: "import-id",
            metadata: {
              projectName: "Baton Rouge",
              programName: "Best Places to Work in Baton Rouge 2026",
              programYear: 2026,
            },
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.createHistoricalImport({
      projectName: "Baton Rouge",
      programName: "Best Places to Work in Baton Rouge 2026",
      programYear: 2026,
      efsLaunchDate: "2026-01-01",
      efsDeadline: "2026-06-30",
    });

    expect(result).toEqual({
      importId: "import-id",
      metadata: {
        projectName: "Baton Rouge",
        programName: "Best Places to Work in Baton Rouge 2026",
        programYear: 2026,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/historicalImports"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectName: "Baton Rouge",
          programName: "Best Places to Work in Baton Rouge 2026",
          programYear: 2026,
          efsLaunchDate: "2026-01-01",
          efsDeadline: "2026-06-30",
        }),
      }),
    );
  });

  it("loads organizations from the program-scoped Zoho endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: [
            {
              organizationId: "49",
              organizationName: "Acme",
              isWinner: "Y",
              surveysSent: 125,
              stage: "Qualified",
              companySize: 30,
              employeesCount: 125,
              currentZohoCategory: "Small/Medium",
              reportCategory: "25-99",
              overallRank: "4",
              categoryRank: "2",
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.zohoProgramOrganizations("zoho-program-1"),
    ).resolves.toEqual([
      {
        organizationId: "49",
        organizationName: "Acme",
        isWinner: "Y",
        surveysSent: 125,
        stage: "Qualified",
        companySize: 30,
        employeesCount: 125,
        currentZohoCategory: "Small/Medium",
        reportCategory: "25-99",
        overallRank: "4",
        categoryRank: "2",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/zoho/programs/zoho-program-1/organizations"),
      expect.any(Object),
    );
  });

  it("uploads EA and EFS workbooks as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            importId: "import-id",
            eaFileName: "ea.xlsx",
            efsFileName: "efs.xlsx",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const eaFile = new File(["ea"], "ea.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const efsFile = new File(["efs"], "efs.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await api.uploadHistoricalImportWorkbooks("import-id", eaFile, efsFile);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("uploads and summarizes one workbook as soon as it is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            importId: "import-id",
            workbook: {
              kind: "EA",
              fileName: "ea.xlsx",
              sha256: "abc123",
              questions: 12,
              organizations: 4,
              respondents: 20,
              responses: 240,
            },
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const workbook = new File(["ea"], "ea.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(
      api.uploadHistoricalImportWorkbook("import-id", "EA", workbook),
    ).resolves.toMatchObject({ workbook: { kind: "EA", questions: 12 } });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/historicalImports/import-id/workbooks/ea");
    expect(options.method).toBe("POST");
    expect((options.body as FormData).get("workbook")).toBe(workbook);
  });

  it("uploads a ranking extract for bulk winner matching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            organizationPrograms: [],
            matchedOrganizations: 10,
            unmatchedOrganizations: [],
            invalidRows: 2,
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const rankingFile = new File(["ranking"], "ranking.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(
      api.matchHistoricalImportRankingWorkbook("import-id", rankingFile),
    ).resolves.toEqual({
      organizationPrograms: [],
      matchedOrganizations: 10,
      unmatchedOrganizations: [],
      invalidRows: 2,
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/historicalImports/import-id/ranking");
    expect(options.method).toBe("POST");
    expect((options.body as FormData).get("rankingFile")).toBe(rankingFile);
  });
});
