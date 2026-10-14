import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectsPage } from "./admin";
import { api } from "./api";
import { AuthProvider } from "./auth";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("matches project or program names with OR terms and preserves the date filter", async () => {
  vi.spyOn(api, "projects").mockResolvedValue([
    {
      id: "alpha",
      name: "Alpha Project",
      createdAt: "2026-10-13T12:00:00Z",
      programs: [],
    },
    {
      id: "beta",
      name: "Beta Project",
      createdAt: "2026-10-14T12:00:00Z",
      programs: [
        {
          id: "program",
          name: "Workforce Program",
          year: 2026,
          createdAt: null,
          organizationCount: 0,
          winnersCount: 0,
          categorySummaries: [],
          latestZohoSync: null,
        },
      ],
    },
    { id: "gamma", name: "Gamma Project", createdAt: null, programs: [] },
  ]);
  render(
    <MemoryRouter>
      <AuthProvider>
        <ProjectsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText("Alpha Project");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: " ALPHA | workforce | | " },
  });
  expect(screen.getByText("Alpha Project")).toBeTruthy();
  expect(screen.getByText("Beta Project")).toBeTruthy();
  expect(screen.queryByText("Gamma Project")).toBeNull();
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-10-14" },
  });
  expect(screen.getByText("Beta Project")).toBeTruthy();
  expect(screen.queryByText("Alpha Project")).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: " | | " } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
  expect(screen.getByText("Gamma Project")).toBeTruthy();
});
