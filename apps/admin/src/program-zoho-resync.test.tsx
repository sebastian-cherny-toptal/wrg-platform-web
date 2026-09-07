import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

  it("renders cleared and boolean values readably", () => {
    const { rerender } = render(
      <ZohoResyncValue
        change={{ field: "reportCategory", previous: "25-99", next: null }}
        value="25-99"
      />,
    );
    expect(screen.getByText("Not provided")).toBeTruthy();

    rerender(
      <ZohoResyncValue
        change={{ field: "isWinner", previous: false, next: true }}
        value={false}
      />,
    );
    expect(screen.getByText("N")).toBeTruthy();
    expect(screen.getByText("Y")).toBeTruthy();
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
      categorySummaries: [{ category: "Community", winners: 0, total: 1 }],
      latestZohoSync: "2026-09-07T10:15:00.000Z",
    });
    vi.spyOn(api, "organizations").mockResolvedValue([
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
        isWinner: false,
        isIncluded: true,
        companySize: 45,
        employeesCount: 40,
        overallRank: "8",
        categoryRank: "3",
        currentZohoCategory: "Small",
        reportCategory: "25-99",
        benchmarkCategory: null,
        organizationProgramId: "enrollment-id",
        benefitsBestPracticesFileName: null,
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
      unmatchedZoho: [],
      missingLocal: [],
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
    fireEvent.click(screen.getByRole("button", { name: "Re-Sync All Deals" }));

    expect(await screen.findByText("Closed")).toBeTruthy();
    const changedRow = screen.getByRole("row", { name: /Acme/u });
    expect(changedRow.classList.contains("zoho-resync-changed-row")).toBe(true);
    expect(changedRow.querySelectorAll("del")).toHaveLength(3);

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
});
