import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminAuthChangedEvent,
  api,
  field,
  formatDate,
  organization,
  persistAuth,
  readAuth,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("admin API projections", () => {
  it("reads the first available compatibility field", () => {
    expect(
      field({ Account_Name: "Demo Organization" }, "name", "Account_Name"),
    ).toBe("Demo Organization");
  });

  it("renders missing dates safely", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("projects source organization identity separately from the display name", () => {
    expect(
      organization({
        _id: "organization-uuid",
        Account_Name: "Baton Rouge Organization D6EA749C",
        sourceOrganizationId: "19",
        sourceOrganizationName: "19",
        orgPrograms: [
          {
            orgs: {
              _id: "organization-program-uuid",
              Surveys_Sent: 200,
              publishedReports: {
                benefitsBestPractices: { sourceFile: "benefits.xlsx" },
              },
            },
          },
        ],
        users: [],
      }),
    ).toMatchObject({
      id: "organization-uuid",
      sourceId: "19",
      sourceName: "19",
      name: "Baton Rouge Organization D6EA749C",
      surveysSent: 200,
      organizationProgramId: "organization-program-uuid",
      benefitsBestPracticesFileName: "benefits.xlsx",
    });
  });

  it("uses a genuine source organization name when one is available", () => {
    expect(
      organization({
        _id: "organization-uuid",
        Account_Name: "Anonymized Organization",
        sourceOrganizationId: "19",
        sourceOrganizationName: "Example Company",
        orgPrograms: [],
        users: [],
      }).name,
    ).toBe("Example Company");
  });

  it("projects the programs available to an organization", () => {
    expect(
      organization({
        _id: "organization-id",
        Account_Name: "Example Company",
        orgPrograms: [
          {
            orgs: {
              projectId: "project-id",
              projectName: "Feedback Project",
              programId: [
                {
                  _id: "program-id",
                  Name: "Feedback 2026",
                  Program_Year: 2026,
                },
              ],
            },
          },
        ],
        users: [],
      }).programs,
    ).toEqual([
      {
        id: "program-id",
        name: "Feedback 2026",
        year: 2026,
        projectId: "project-id",
        projectName: "Feedback Project",
      },
    ]);
  });

  it("includes the username when creating a user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.createUser({
      fullName: "Example Person",
      email: "person@example.com",
      username: "example.person",
      mobile: "555-0100",
      roleId: "role-id",
      projects: ["project-id"],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      fullName: "Example Person",
      email: "person@example.com",
      username: "example.person",
      mobile: "555-0100",
      roleId: "role-id",
      projects: ["project-id"],
    });
  });

  it("submits organization and programs for a client user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.createUser({
      fullName: "Client Person",
      email: "client@example.com",
      username: "client.person",
      roleId: "client-role-id",
      organizationId: "organization-id",
      programs: ["program-id"],
      projects: [],
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      roleId: "client-role-id",
      organizationId: "organization-id",
      programs: ["program-id"],
      projects: [],
    });
  });

  it("returns the one-time temporary password from an administrator reset", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            username: "client.person",
            email: "client@example.com",
            temporaryPassword: "one-time-secret",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.resetUserPassword("user-id")).resolves.toEqual({
      username: "client.person",
      email: "client@example.com",
      temporaryPassword: "one-time-secret",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/user/admin-generate-temp-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-id" }),
      }),
    );
  });

  it("accepts a Super Admin principal after login", async () => {
    const payload = btoa(
      JSON.stringify({
        sub: "super-admin-id",
        roles: ["super_admin"],
        permissions: ["ops.manage"],
      }),
    );
    const accessToken = `header.${payload}.signature`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              accessToken,
              refreshToken: "refresh-token",
              user: {
                id: "super-admin-id",
                email: "admin@example.com",
                fullName: "Super Admin",
                role: "super_admin",
              },
            },
          }),
      }),
    );

    await expect(
      api.completeLogin("admin@example.com", "super-admin-id"),
    ).resolves.toMatchObject({
      user: { roles: ["super_admin"] },
    });
  });

  it("closes the admin session when an authenticated request returns 401", async () => {
    persistAuth({
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      user: {
        id: "admin-id",
        displayName: "Example Admin",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });
    const authChanged = vi.fn();
    window.addEventListener(adminAuthChangedEvent, authChanged);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.projects()).rejects.toMatchObject({ status: 401 });

    expect(readAuth()).toBeNull();
    expect(authChanged).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer expired-access-token",
        }),
      }),
    );
    window.removeEventListener(adminAuthChangedEvent, authChanged);
  });
});
