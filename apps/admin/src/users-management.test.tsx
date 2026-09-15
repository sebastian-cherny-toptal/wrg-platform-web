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
  role: "admin",
  roleId: "admin",
  organization: { id: "org-1", name: "Acme" },
  projects: [
    { id: "p1", name: "Workforce" },
    { id: "p2", name: "Benefits" },
  ],
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
  expect(within(table).getAllByRole("columnheader")).toHaveLength(13);
  expect(within(table).getByText("Workforce · Benefits")).toBeTruthy();
  expect(within(table).getByText("Acme")).toBeTruthy();
  fireEvent.click(screen.getByText("Columns to show (13/13)"));
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
  expect(within(table).getAllByRole("cell")).toHaveLength(12);
  fireEvent.click(screen.getByRole("checkbox", { name: "Organizations" }));
  expect(within(table).queryByText("Acme")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select all columns" }));
  expect(within(table).getAllByRole("columnheader")).toHaveLength(13);
  expect(within(table).getByText("Acme")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Search users"), {
    target: { value: "Benefits" },
  });
  expect(within(table).getByText("Alex Example")).toBeTruthy();
});

it("allows clearing all columns and restoring them", async () => {
  vi.spyOn(api, "users").mockResolvedValue([user]);
  render(
    <MemoryRouter>
      <UsersManagementPage />
    </MemoryRouter>,
  );
  await screen.findByRole("table");
  fireEvent.click(screen.getByText("Columns to show (13/13)"));
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByText("Select at least one column to display the users table."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Select all columns" }));
  expect(screen.getByRole("table")).toBeTruthy();
});
