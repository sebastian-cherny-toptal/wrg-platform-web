import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin";
import { api, persistAuth } from "./api";
import { AuthProvider } from "./auth";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("admin sidebar", () => {
  it("shows the total number of records for every collection view", async () => {
    persistAuth({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "admin-id",
        displayName: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
        permissions: [],
      },
    });
    vi.spyOn(api, "adminViewCounts").mockResolvedValue({
      projects: 4,
      users: 5,
      keyImpactAnalyses: 2,
      orders: 8,
      activity: 13,
      roles: 3,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<div>Admin home</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", {
        name: "Imported Projects & Programs (4)",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Users Management (5)" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "KIA Uploads (2)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Order Log (8)" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Activity Log (13)" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Roles (3)" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Import Historical Project" }),
    ).toBeTruthy();
  });
});
