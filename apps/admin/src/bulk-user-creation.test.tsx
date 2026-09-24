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
  vi.spyOn(api, "bulkUserCatalog").mockResolvedValue({
    roles: [{ id: "admin", key: "admin", name: "Admin", userCount: 0 }],
    projects: [],
    organizations: [],
    users: [],
  });
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
  vi.spyOn(api, "bulkUserCatalog").mockResolvedValue({
    roles: [{ id: "client", key: "client", name: "Client", userCount: 1 }],
    projects: [
      {
        id: "project-1",
        name: "Workforce",
        programs: [
          { id: "program-1", name: "Awards 2025", year: 2025 },
          { id: "program-2", name: "Awards 2026", year: 2026 },
        ],
      },
    ],
    organizations: [
      {
        id: "org-1",
        name: "Acme",
        programIds: ["program-1", "program-2"],
      },
    ],
    users: [
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
        programDetails: [{ id: "program-1", name: "Awards 2025", year: 2025 }],
      },
    ],
  });
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

it("creates a promotional user with optional Organization and Program assignments", async () => {
  vi.spyOn(api, "bulkUserCatalog").mockResolvedValue({
    roles: [
      {
        id: "promotional-role",
        key: "promotional",
        name: "Promotional",
        userCount: 0,
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "Ad Age",
        programs: [
          {
            id: "program-1",
            name: "Ad Age Best Places to Work 2026",
            year: 2026,
          },
        ],
      },
    ],
    organizations: [
      { id: "organization-1", name: "PMG", programIds: ["program-1"] },
    ],
    users: [],
  });
  const create = vi.spyOn(api, "createUser").mockResolvedValue();
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
      "Full Name,Email,Username,Role,Project,Program,Organization\nPMG,david@pmg.com,PMG_107_AA_553,Promotional,Ad Age,Ad Age Best Places to Work 2026,PMG",
  });
  fireEvent.change(upload, { target: { files: [file] } });
  fireEvent.click(
    await screen.findByRole("button", { name: "Process 1 users" }),
  );
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith({
      fullName: "PMG",
      email: "david@pmg.com",
      username: "PMG_107_AA_553",
      mobile: "",
      roleId: "promotional-role",
      projects: ["project-1"],
      organizationId: "organization-1",
      programs: ["program-1"],
    }),
  );
});

it.each([
  ["admin", "Administrator"],
  ["super_admin", "Super Admin"],
])(
  "treats exported role %s and display name %s as the same role",
  async (roleKey, roleName) => {
    vi.spyOn(api, "bulkUserCatalog").mockResolvedValue({
      roles: [
        {
          id: `${roleKey}-id`,
          key: roleKey,
          name: roleName,
          userCount: 1,
        },
      ],
      projects: [],
      organizations: [],
      users: [
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
        },
      ],
    });
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

it("revalidates only the edited row while typing Organization or Program", async () => {
  let eligibilityReads = 0;
  const organizations = Array.from({ length: 100 }, (_, index) => ({
    id: `organization-${index}`,
    name: `Organization ${index}`,
    get programIds() {
      eligibilityReads += 1;
      return ["program-1"];
    },
  }));
  vi.spyOn(api, "bulkUserCatalog").mockResolvedValue({
    roles: [{ id: "client", key: "client", name: "Client", userCount: 0 }],
    projects: [
      {
        id: "project-1",
        name: "Workforce",
        programs: [{ id: "program-1", name: "Awards", year: 2026 }],
      },
    ],
    organizations,
    users: [],
  });
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
  const lines = Array.from(
    { length: 50 },
    (_, index) =>
      `User ${index},user${index}@example.com,user${index},Client,Workforce,Awards,Organization 99`,
  );
  const file = new File([], "users.csv");
  Object.defineProperty(file, "text", {
    value: async () =>
      [
        "Full Name,Email,Username,Role,Project,Program,Organization",
        ...lines,
      ].join("\n"),
  });
  fireEvent.change(upload, { target: { files: [file] } });
  await screen.findByRole("button", { name: "Process 50 users" });

  eligibilityReads = 0;
  fireEvent.change(screen.getByLabelText("Row 2 Organization"), {
    target: { value: "Organization 98" },
  });

  expect(eligibilityReads).toBeLessThanOrEqual(100);
  expect(screen.getByRole("button", { name: "Process 50 users" })).toBeTruthy();
});
