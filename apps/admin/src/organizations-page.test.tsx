import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationsPage } from "./admin";
import { api, type OrganizationDirectoryRecord } from "./api";
const rows: OrganizationDirectoryRecord[] = [
  {
    id: "org-linked",
    createdAt: "2026-10-13T12:00:00.000Z",
    displayId: "EXT-123",
    name: "Linked Organization",
    projects: [{ id: "project", name: "Alpha Project" }],
    programs: [{ id: "program", name: "Beta Program" }],
    users: [
      {
        id: "user",
        fullName: "Jane Doe",
        email: "jane@example.com",
        username: "jdoe",
      },
    ],
  },
  {
    id: "org-empty",
    createdAt: "2026-10-13T12:00:00.000Z",
    displayId: "EMPTY-456",
    name: "Empty Organization",
    projects: [],
    programs: [],
    users: [],
  },
  {
    id: "org-user",
    createdAt: "2026-10-13T12:00:00.000Z",
    displayId: "USER-789",
    name: "User Only",
    projects: [],
    programs: [],
    users: [
      {
        id: "user2",
        fullName: "Other User",
        email: "other@example.com",
        username: null,
      },
    ],
  },
  {
    id: "org-program",
    createdAt: "2026-10-13T12:00:00.000Z",
    displayId: "PROGRAM-000",
    name: "Program Only",
    projects: [],
    programs: [{ id: "only", name: "Only Program" }],
    users: [],
  },
];
async function mount() {
  vi.spyOn(api, "organizationDirectory").mockResolvedValue(rows);
  render(
    <MemoryRouter>
      <OrganizationsPage />
    </MemoryRouter>,
  );
  await screen.findByText("Linked Organization");
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("organizations table", () => {
  it("shows columns and only enables deletion for empty organizations", async () => {
    await mount();
    for (const name of [
      "Name",
      "ID",
      "Created Date",
      "Projects",
      "Programs",
      "Users",
      "Actions",
    ])
      expect(screen.getByRole("columnheader", { name })).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Delete Empty Organization",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    for (const name of ["Linked Organization", "User Only", "Program Only"]) {
      const button = screen.getByRole("button", {
        name: `Delete ${name}`,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.parentElement?.title).toBe(
        "Remove this organization from its Project and Users before deleting it",
      );
    }
  });
  it("searches all fields case-insensitively", async () => {
    await mount();
    for (const query of [
      "LINKED",
      "ext-123",
      "ORG-LINKED",
      "ALPHA",
      "BETA",
      "JANE",
      "JDOE",
      "JANE@EXAMPLE.COM",
    ]) {
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: query },
      });
      expect(screen.getByText("Linked Organization")).toBeTruthy();
      expect(screen.queryByText("Empty Organization")).toBeNull();
    }
  });
  it("filters out organizations with either programs or users", async () => {
    await mount();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "No program or user" }),
    );
    expect(screen.getByText("Empty Organization")).toBeTruthy();
    for (const name of ["Linked Organization", "User Only", "Program Only"])
      expect(screen.queryByText(name)).toBeNull();
  });
  it("sorts by name, project, program and user in both directions", async () => {
    await mount();
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("td")?.textContent);
    expect(names()[0]).toBe("Empty Organization");
    for (const key of ["Name", "Projects", "Programs", "Users"]) {
      fireEvent.click(screen.getByRole("button", { name: "Sort records" }));
      fireEvent.click(screen.getByRole("option", { name: `${key} Z–A` }));
      const descending = names();
      fireEvent.click(screen.getByRole("button", { name: "Sort records" }));
      fireEvent.click(screen.getByRole("option", { name: `${key} A–Z` }));
      expect(names()).toEqual([...descending].reverse());
    }
  });
  it("sorts creation timestamps chronologically in both directions with missing dates last", async () => {
    const dates = [
      "2026-10-13T10:30:00+02:00",
      "2026-10-13T09:00:00Z",
      "2026-10-12T12:00:00Z",
      null,
    ];
    vi.spyOn(api, "organizationDirectory").mockResolvedValue(
      rows.map((row, index) => ({ ...row, createdAt: dates[index] ?? null })),
    );
    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Linked Organization");
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("td")?.textContent);
    fireEvent.click(screen.getByRole("button", { name: "Sort records" }));
    fireEvent.click(
      screen.getByRole("option", { name: "Created Date — newest first" }),
    );
    expect(names()).toEqual([
      "Empty Organization",
      "Linked Organization",
      "User Only",
      "Program Only",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sort records" }));
    fireEvent.click(
      screen.getByRole("option", { name: "Created Date — oldest first" }),
    );
    expect(names()).toEqual([
      "User Only",
      "Linked Organization",
      "Empty Organization",
      "Program Only",
    ]);
  });
  it("confirms deletion and refreshes", async () => {
    await mount();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const remove = vi.spyOn(api, "deleteOrganization").mockResolvedValue();
    vi.mocked(api.organizationDirectory).mockResolvedValue(
      rows.filter((row) => row.id !== "org-empty"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Empty Organization" }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("org-empty"));
    await waitFor(() =>
      expect(screen.queryByText("Empty Organization")).toBeNull(),
    );
  });
});
