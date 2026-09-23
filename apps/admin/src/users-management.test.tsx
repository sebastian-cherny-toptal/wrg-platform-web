import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { UsersManagementPage } from "./admin";
import { api, type UserRecord } from "./api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const user: UserRecord = {
  id: "user-1",
  fullName: "Alex Example",
  email: "alex@example.com",
  username: "alex",
  mobile: null,
  role: "admin",
  roleId: "admin",
  organization: { id: "org-1", name: "Acme" },
  projects: [
    { id: "p1", name: "Workforce" },
    { id: "p2", name: "Benefits" },
  ],
  programDetails: [],
  createdAt: null,
  lastLogin: null,
  status: "ACTIVE",
  payments: [],
  totalPaid: [],
  lastPaymentDatetime: null,
};

it("shows memberships and all columns by default, and toggles aligned headers and cells", async () => {
  vi.spyOn(api, "users").mockResolvedValue([user]);
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  const table = await screen.findByRole("table");
  expect(within(table).getAllByRole("columnheader")).toHaveLength(14);
  expect(within(table).getByText("Workforce · Benefits")).toBeTruthy();
  expect(within(table).getByText("Acme")).toBeTruthy();
  fireEvent.click(screen.getByText("Columns to show (14/14)"));
  expect(
    screen
      .getAllByRole("checkbox")
      .every((input) => (input as HTMLInputElement).checked),
  ).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Projects" }));
  expect(
    within(table).queryByRole("columnheader", { name: "Projects" }),
  ).toBeNull();
  expect(within(table).queryByText("Workforce · Benefits")).toBeNull();
  expect(
    within(table).getByRole("columnheader", { name: "Organizations" }),
  ).toBeTruthy();
  expect(within(table).getAllByRole("cell")).toHaveLength(13);
  fireEvent.click(screen.getByRole("checkbox", { name: "Organizations" }));
  expect(within(table).queryByText("Acme")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select all columns" }));
  expect(within(table).getAllByRole("columnheader")).toHaveLength(14);
  expect(within(table).getByText("Acme")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Search users"), {
    target: { value: "Benefits" },
  });
  expect(within(table).getByText("Alex Example")).toBeTruthy();
});

it("shows the three primary actions in order and downloads the complete user set", async () => {
  vi.spyOn(api, "users").mockResolvedValue([user]);
  const createObjectUrl = vi.fn(() => "blob:users");
  const revokeObjectUrl = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectUrl,
  });
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  await screen.findByRole("table");
  const add = screen.getByRole("button", { name: "+ Add User" });
  const bulk = screen.getByRole("button", { name: "Bulk Creation" });
  const download = screen.getByRole("button", { name: /Download All Users/ });
  expect(
    add.compareDocumentPosition(bulk) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    bulk.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(download);
  expect(createObjectUrl).toHaveBeenCalledTimes(1);
  expect(revokeObjectUrl).toHaveBeenCalledWith("blob:users");
});

it("allows clearing all columns and restoring them", async () => {
  vi.spyOn(api, "users").mockResolvedValue([user]);
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  await screen.findByRole("table");
  fireEvent.click(screen.getByText("Columns to show (14/14)"));
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByText("Select at least one column to display the users table."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Select all columns" }));
  expect(screen.getByRole("table")).toBeTruthy();
});

it("shows zero, one, and multiple assigned programs and toggles their column", async () => {
  vi.spyOn(api, "users").mockResolvedValue([
    user,
    {
      ...user,
      id: "user-2",
      fullName: "Blair Example",
      programDetails: [{ id: "program-2025", name: "Workforce", year: 2025 }],
    },
    {
      ...user,
      id: "user-3",
      fullName: "Casey Example",
      programDetails: [
        { id: "program-2025", name: "Workforce", year: 2025 },
        { id: "program-2026", name: "Benefits", year: 2026 },
      ],
    },
  ]);
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  const table = await screen.findByRole("table");
  const rows = within(table).getAllByRole("row");
  expect(within(rows[1]).getAllByRole("cell")[5].textContent).toBe("—");
  expect(within(rows[2]).getAllByRole("cell")[5].textContent).toBe(
    "Workforce (2025)",
  );
  expect(within(rows[3]).getAllByRole("cell")[5].textContent).toBe(
    "Workforce (2025)Benefits (2026)",
  );
  fireEvent.click(screen.getByText("Columns to show (14/14)"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Programs" }));
  expect(
    within(table).queryByRole("columnheader", { name: "Programs" }),
  ).toBeNull();
  expect(within(rows[2]).getAllByRole("cell")[5].textContent).toBe("Acme");
});

it("retains earlier programs and adds new years only within assigned projects", async () => {
  vi.spyOn(api, "users")
    .mockResolvedValueOnce([{ ...user, programs: ["old"] }])
    .mockResolvedValue([
      {
        ...user,
        programs: ["old", "new"],
        programDetails: [
          { id: "old", name: "Workforce", year: 2025 },
          { id: "new", name: "Workforce", year: 2026 },
        ],
      },
    ]);
  const program = (id: string, year: number) => ({
    id,
    name: "Workforce",
    year,
    createdAt: null,
    organizationCount: 0,
    winnersCount: 0,
    categorySummaries: [],
    latestZohoSync: null,
  });
  vi.spyOn(api, "projects").mockResolvedValue([
    {
      id: "p1",
      name: "Workforce",
      createdAt: null,
      programs: [program("old", 2025), program("new", 2026)],
    },
    {
      id: "unassigned",
      name: "Other project",
      createdAt: null,
      programs: [program("other", 2027)],
    },
  ]);
  const update = vi.spyOn(api, "updateUser").mockResolvedValue();
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit Alex Example" }),
  );
  const old = await screen.findByRole("checkbox", { name: "Workforce (2025)" });
  expect((old as HTMLInputElement).checked).toBe(true);
  expect(
    screen.queryByRole("checkbox", { name: "Workforce (2027)" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Workforce (2026)" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await vi.waitFor(() =>
    expect(update).toHaveBeenCalledWith("user-1", {
      fullName: "Alex Example",
      email: "alex@example.com",
      username: "alex",
      programs: ["old", "new"],
    }),
  );
  await screen.findByText("Workforce (2026)");
  expect(screen.getByText("Workforce (2025)")).toBeTruthy();
});
