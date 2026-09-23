import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { BulkUserCreation } from "./bulk-user-creation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("reviews uploaded users and retries only failed creations", async () => {
  vi.spyOn(api, "roles").mockResolvedValue([
    { _id: "admin", name: "Admin", role: "admin" },
  ]);
  vi.spyOn(api, "projects").mockResolvedValue([]);
  vi.spyOn(api, "organizations").mockResolvedValue([]);
  vi.spyOn(api, "users").mockResolvedValue([]);
  const create = vi
    .spyOn(api, "createUser")
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce();
  const onCreated = vi.fn();
  render(
    <BulkUserCreation
      onCreated={onCreated}
      onClose={vi.fn()}
      onBusyChange={vi.fn()}
    />,
  );
  const upload = screen.getByLabelText("Upload users spreadsheet");
  await waitFor(() =>
    expect((upload as HTMLInputElement).disabled).toBe(false),
  );
  const file = new File([], "users.csv");
  Object.defineProperty(file, "text", {
    value: async () =>
      "Full Name,Email,Username,Role\nAlex,a@example.com,alex,Admin\nBob,b@example.com,bob,Admin",
  });
  fireEvent.change(upload, { target: { files: [file] } });
  const submit = await screen.findByRole("button", { name: "Process 2 users" });
  fireEvent.click(submit);
  await screen.findByText("Server unavailable");
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Process 1 users" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2));
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls.map(([input]) => input.email)).toEqual([
    "a@example.com",
    "b@example.com",
    "b@example.com",
  ]);
  expect(screen.getByText(/2 completed · 0 remaining/)).toBeTruthy();
});

it("previews and applies changes to an existing user with multiple Programs", async () => {
  vi.spyOn(api, "roles").mockResolvedValue([
    { _id: "client", name: "Client", role: "client" },
  ]);
  vi.spyOn(api, "projects").mockResolvedValue([
    {
      id: "project-1",
      name: "Workforce",
      createdAt: null,
      programs: [
        { id: "program-1", name: "Awards 2025", year: 2025 },
        { id: "program-2", name: "Awards 2026", year: 2026 },
      ].map((program) => ({
        ...program,
        createdAt: null,
        organizationCount: 1,
        winnersCount: 0,
        categorySummaries: [],
        latestZohoSync: null,
      })),
    },
  ]);
  vi.spyOn(api, "organizations").mockResolvedValue([
    {
      id: "org-1",
      selectionId: "org-1",
      name: "Acme",
      programs: [
        {
          id: "program-1",
          name: "Awards 2025",
          year: 2025,
          projectId: "project-1",
          projectName: "Workforce",
        },
        {
          id: "program-2",
          name: "Awards 2026",
          year: 2026,
          projectId: "project-1",
          projectName: "Workforce",
        },
      ],
      users: [],
      sourceId: "org-1",
      sourceName: null,
      createdAt: null,
      stage: null,
      lastSyncedAt: null,
      surveysSent: 0,
      isWinner: null,
      isIncluded: true,
      companySize: null,
      employeesCount: null,
      overallRank: null,
      categoryRank: null,
      currentZohoCategory: null,
      reportCategory: null,
      benchmarkCategory: null,
      purchasedEvSortingFilter: null,
      organizationProgramId: "enrollment-1",
    },
  ]);
  vi.spyOn(api, "users").mockResolvedValue([
    {
      id: "user-1",
      fullName: "Alex Old",
      email: "alex@example.com",
      username: "alex",
      mobile: "111",
      role: "client",
      roleId: "client",
      organization: { id: "org-1", name: "Acme" },
      projects: [{ id: "project-1", name: "Workforce" }],
      programs: ["program-1"],
      programDetails: [{ id: "program-1", name: "Awards 2025", year: 2025 }],
      createdAt: null,
      lastLogin: null,
      status: "ACTIVE",
      payments: [],
      totalPaid: [],
      lastPaymentDatetime: null,
    },
  ]);
  const update = vi.spyOn(api, "updateUser").mockResolvedValue();
  render(
    <BulkUserCreation
      onCreated={vi.fn()}
      onClose={vi.fn()}
      onBusyChange={vi.fn()}
    />,
  );
  const upload = screen.getByLabelText("Upload users spreadsheet");
  await waitFor(() =>
    expect((upload as HTMLInputElement).disabled).toBe(false),
  );
  const file = new File([], "users.csv");
  Object.defineProperty(file, "text", {
    value: async () =>
      'Full Name,Email,Username,Role,Project,Program,Organization,Mobile\nAlex New,alex@example.com,alex,Client,Workforce,"Awards 2025, Awards 2026",Acme,222',
  });
  fireEvent.change(upload, { target: { files: [file] } });

  expect(await screen.findByText("Alex Old", { selector: "del" })).toBeTruthy();
  expect(screen.getByText("Awards 2025", { selector: "del" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Process 1 users" }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith("user-1", {
      fullName: "Alex New",
      email: "alex@example.com",
      username: "alex",
      mobile: "222",
      roleId: "client",
      organizationId: "org-1",
      programs: ["program-1", "program-2"],
    }),
  );
  expect(await screen.findByText("Row 2 · Updated")).toBeTruthy();
});

it.each([
  ["admin", "Administrator"],
  ["super_admin", "Super Admin"],
])(
  "treats exported role %s and display name %s as the same role",
  async (roleKey, roleName) => {
    vi.spyOn(api, "roles").mockResolvedValue([
      { _id: `${roleKey}-id`, name: roleName, role: roleKey },
    ]);
    vi.spyOn(api, "projects").mockResolvedValue([]);
    vi.spyOn(api, "organizations").mockResolvedValue([]);
    vi.spyOn(api, "users").mockResolvedValue([
      {
        id: "user-1",
        fullName: "Alex Example",
        email: "alex@example.com",
        username: "alex",
        mobile: null,
        role: roleKey,
        roleId: `${roleKey}-id`,
        organization: null,
        projects: [],
        programDetails: [],
        createdAt: null,
        lastLogin: null,
        status: "ACTIVE",
        payments: [],
        totalPaid: [],
        lastPaymentDatetime: null,
      },
    ]);
    const update = vi.spyOn(api, "updateUser").mockResolvedValue();
    render(
      <BulkUserCreation
        onCreated={vi.fn()}
        onClose={vi.fn()}
        onBusyChange={vi.fn()}
      />,
    );
    const upload = screen.getByLabelText("Upload users spreadsheet");
    await waitFor(() =>
      expect((upload as HTMLInputElement).disabled).toBe(false),
    );
    const file = new File([], "users.csv");
    Object.defineProperty(file, "text", {
      value: async () =>
        `Full Name,Email,Username,Role\nAlex Example,alex@example.com,alex,${roleKey}`,
    });
    fireEvent.change(upload, { target: { files: [file] } });
    fireEvent.click(
      await screen.findByRole("button", { name: "Process 1 users" }),
    );
    expect(await screen.findByText("Row 2 · No changes")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  },
);
