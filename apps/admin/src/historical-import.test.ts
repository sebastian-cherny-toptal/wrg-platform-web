import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("historical import API client", () => {
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
});
