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
  const submit = await screen.findByRole("button", { name: "Create 2 users" });
  fireEvent.click(submit);
  await screen.findByText("Server unavailable");
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Create 1 users" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2));
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls.map(([input]) => input.email)).toEqual([
    "a@example.com",
    "b@example.com",
    "b@example.com",
  ]);
  expect(screen.getByText(/2 created · 0 remaining/)).toBeTruthy();
});
