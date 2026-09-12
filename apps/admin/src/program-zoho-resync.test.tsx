import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramDetailPage, ZohoResyncValue } from "./admin";
import { api, persistAuth, type ProgramZohoResyncPreview } from "./api";
import { AuthProvider } from "./auth";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("program Zoho resync changes", () => {
  it("shows the database value crossed out beside the new Zoho value", () => {
    const { container } = render(
      <ZohoResyncValue
        change={{ field: "stage", previous: "Invited", next: "Closed" }}
        value="Invited"
      />,
    );

    expect(container.querySelector("del")?.textContent).toBe("Invited");
    expect(screen.getByText("Closed")).toBeTruthy();
  });

  it("renders cleared and winner-status values readably", () => {
    const { rerender } = render(
      <ZohoResyncValue
        change={{ field: "reportCategory", previous: "25-99", next: null }}
        value="25-99"
      />,
    );
    expect(screen.getByText("Not provided")).toBeTruthy();

    rerender(
      <ZohoResyncValue
        change={{ field: "isWinner", previous: "N", next: "Y" }}
        value="N"
      />,
    );
    expect(screen.getByText("N")).toBeTruthy();
    expect(screen.getByText("Y")).toBeTruthy();

    rerender(<ZohoResyncValue value={null} />);
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it("reviews and applies all program changes from the organization table", async () => {
    persistAuth({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "admin-id",
        displayName: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });
    vi.spyOn(api, "program").mockResolvedValue({
      id: "program-id",
      name: "Program 2026",
      year: 2026,
      createdAt: null,
      organizationCount: 1,
      winnersCount: 0,
      categorySummaries: [
        { category: "Small", winners: 0, nonWinners: 1, total: 1 },
        { category: "Community", winners: 0, nonWinners: 0, total: 0 },
      ],
      latestZohoSync: "2026-09-07T10:15:00.000Z",
    });
    vi.spyOn(api, "organizations").mockResolvedValue([
      {
        id: "unchanged-organization-id",
        selectionId: "unchanged-enrollment-id",
        sourceId: "1",
        sourceName: "Before Company",
        name: "Before Company",
        createdAt: null,
        stage: "Invited",
        lastSyncedAt: null,
        surveysSent: 25,
        isWinner: "N",
        isIncluded: true,
        companySize: 25,
        employeesCount: 20,
        overallRank: "9",
        categoryRank: "4",
        currentZohoCategory: "Small",
        reportCategory: "25-99",
        benchmarkCategory: null,
        organizationProgramId: "unchanged-enrollment-id",
        programs: [],
        users: [],
      },
      {
        id: "organization-id",
        selectionId: "enrollment-id",
        sourceId: "49",
        sourceName: "Acme",
        name: "Acme",
        createdAt: null,
        stage: "Invited",
        lastSyncedAt: null,
        surveysSent: 50,
        isWinner: "N",
        isIncluded: true,
        companySize: 45,
        employeesCount: 40,
        overallRank: "8",
        categoryRank: "3",
        currentZohoCategory: "Small",
        reportCategory: "25-99",
        benchmarkCategory: null,
        organizationProgramId: "enrollment-id",
        programs: [],
        users: [],
      },
    ]);
    const preview: ProgramZohoResyncPreview = {
      programId: "program-id",
      revision: "a".repeat(64),
      changedRows: [
        {
          organizationProgramId: "enrollment-id",
          organizationId: "49",
          organizationName: "Acme",
          changes: [
            { field: "stage", previous: "Invited", next: "Closed" },
            {
              field: "reportCategory",
              previous: "25-99",
              next: "50-99",
            },
            {
              field: "currentZohoCategory",
              previous: "Small",
              next: "Community",
            },
          ],
        },
      ],
      unmatchedZoho: [
        {
          organizationId: "zoho-only-id",
          organizationName: "Zoho Only Company",
        },
      ],
      missingLocal: [
        {
          organizationProgramId: "local-only-enrollment-id",
          organizationName: "Local Only Company",
        },
      ],
    };
    vi.spyOn(api, "previewProgramZohoResync").mockResolvedValue(preview);
    const apply = vi
      .spyOn(api, "applyProgramZohoResync")
      .mockResolvedValue({ ...preview, appliedCount: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={["/admin/projects/project-id/programs/program-id"]}
        >
          <Routes>
            <Route
              path="/admin/projects/:projectId/programs/:programId"
              element={<ProgramDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("Report Category")).toBeTruthy();
    expect(screen.getByText("Benchmark Category")).toBeTruthy();
    expect(screen.getByText(/Latest Zoho sync:/u).textContent).toContain(
      "Sep 7, 2026",
    );
    const syncPanel = screen.getByRole("region", {
      name: "Zoho deal synchronization",
    });
    expect(
      within(syncPanel).getByRole("button", {
        name: "Download organizations connection fields",
      }),
    ).toBeTruthy();
    expect(
      within(syncPanel).getByRole("button", { name: "Re-Sync All Deals" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Re-Sync All Deals" }));

    expect(await screen.findByText("Closed")).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Re-Sync All Deals",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText("Zoho Only Company")).toBeTruthy();
    expect(screen.getByText("Zoho organization ID: zoho-only-id")).toBeTruthy();
    expect(screen.getByText("Local Only Company")).toBeTruthy();
    expect(
      document.querySelectorAll(".zoho-resync-summary-change"),
    ).toHaveLength(4);
    const changedRow = screen.getByRole("row", { name: /Acme/u });
    expect(changedRow.classList.contains("zoho-resync-changed-row")).toBe(true);
    expect(changedRow.querySelectorAll("del")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Sort records" }).textContent,
    ).toBe("Rows being edited first");
    const organizationRows = screen.getAllByRole("row").slice(1);
    expect(organizationRows[0]).toBe(changedRow);
    expect(organizationRows[1].textContent).toContain("Before Company");

    fireEvent.click(
      screen.getByRole("button", { name: "Apply all Zoho changes" }),
    );
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith("program-id", preview.revision),
    );
    expect(
      await screen.findByText(/Applied Zoho changes to 1 organization/u),
    ).toBeTruthy();
  });

  it("paginates organizations in groups of ten", async () => {
    persistAuth({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "admin-id",
        displayName: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });
    vi.spyOn(api, "program").mockResolvedValue({
      id: "program-id",
      name: "Program 2026",
      year: 2026,
      createdAt: null,
      organizationCount: 21,
      winnersCount: 0,
      categorySummaries: [],
      latestZohoSync: null,
    });
    vi.spyOn(api, "organizations").mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => ({
        id: `organization-${index + 1}`,
        selectionId: `enrollment-${index + 1}`,
        sourceId: String(index + 1),
        sourceName: `Company ${index + 1}`,
        name: `Company ${index + 1}`,
        createdAt: null,
        stage: null,
        lastSyncedAt: null,
        surveysSent: 0,
        isWinner: "N",
        isIncluded: true,
        companySize: null,
        employeesCount: null,
        overallRank: null,
        categoryRank: null,
        currentZohoCategory: null,
        reportCategory: null,
        benchmarkCategory: null,
        organizationProgramId: `enrollment-${index + 1}`,
        programs: [],
        users: [],
      })),
    );

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={["/admin/projects/project-id/programs/program-id"]}
        >
          <Routes>
            <Route
              path="/admin/projects/:projectId/programs/:programId"
              element={<ProgramDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("1 - 10 of 21")).toBeTruthy();
    expect(screen.getByText("Company 10")).toBeTruthy();
    expect(screen.queryByText("Company 11")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("11 - 20 of 21")).toBeTruthy();
    expect(screen.getByText("Company 11")).toBeTruthy();
    expect(screen.queryByText("Company 10")).toBeNull();
  });
});
