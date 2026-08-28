import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import {
  applyZohoWinners,
  applyZohoOrganizations,
  filterAndSortProjects,
  filterWinnerOrganizations,
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
      isWinner: false,
    },
    {
      organizationKey: "org2",
      organizationName: "Beta Company",
      surveysSent: 0,
      isWinner: false,
    },
    {
      organizationKey: "org5",
      organizationName: "Fifth Group",
      surveysSent: 0,
      isWinner: false,
    },
  ];

  it("matches comma-separated names or IDs in the entered order", () => {
    expect(filterWinnerOrganizations(organizations, "org5, alpha")).toEqual([
      organizations[2],
      organizations[0],
    ]);
  });

  it("automatically marks Zoho winners by organization ID or name", () => {
    expect(
      applyZohoWinners(
        [{ ...organizations[0], sourceOrganizationId: "49" }, organizations[1]],
        [
          {
            organizationId: "49",
            organizationName: "Different display name",
            currentYearCategory: "Large",
          },
          {
            organizationId: "50",
            organizationName: "Beta Company",
            currentYearCategory: null,
          },
        ],
      ),
    ).toMatchObject([
      { isWinner: true, currentYearCategory: "Large" },
      { isWinner: true },
    ]);
  });

  it("applies all program-scoped Zoho organization fields and splits deal names", () => {
    expect(
      applyZohoOrganizations(organizations.slice(0, 2), [
        {
          organizationId: "49",
          organizationName: "Alpha Company - Baton Rouge 2026",
          isWinner: true,
          surveysSent: 125,
          currentYearCategory: "Large",
        },
        {
          organizationId: "50",
          organizationName: "Beta Company - Baton Rouge 2026",
          isWinner: false,
          surveysSent: 80,
          currentYearCategory: "Small",
        },
      ]),
    ).toMatchObject([
      {
        isWinner: true,
        surveysSent: 125,
        currentYearCategory: "Large",
      },
      {
        isWinner: false,
        surveysSent: 80,
        currentYearCategory: "Small",
      },
    ]);
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

describe("Benefits & Best Practices API client", () => {
  it("uploads one program workbook as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            programId: "program-id",
            sourceFile: "benefits.xlsx",
            headerCount: 2,
            sectionCount: 1,
            uploadedAt: "2026-08-17T12:00:00.000Z",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["workbook"], "benefits.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await api.uploadBenefitsBestPracticesWorkbook(
      "organization-program-id",
      file,
    );

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      "/admin/organization-programs/organization-program-id/benefits-best-practices",
    );
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("workbook")).toBe(file);
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
      undefined,
    );
  });
});
