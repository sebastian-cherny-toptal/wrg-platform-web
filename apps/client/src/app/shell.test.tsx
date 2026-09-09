import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { Session } from "../api/schemas";
import { useAppStore } from "../store/app-store";
import { AppShell } from "./shell";

const deniedEntitlements = {
  WFR_Access: "no",
  EV_Access: "no",
  WBC_Access: "no",
  BBP_Access: "no",
  RD_Access: "no",
  KIA_Access: "no",
  CR_Access: "no",
} as const;

function session(): Session {
  return {
    user: {
      id: "client-1",
      displayName: "Client User",
      email: "client@example.test",
      role: "client",
      permissions: [],
      programs: [
        {
          id: "program-2026",
          name: "Baton Rouge 2026",
          year: 2026,
          organizationName: "Example Organization",
          entitlements: deniedEntitlements,
        },
      ],
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    impersonation: null,
  };
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  useAppStore.getState().setSession(null);
});

describe("client sidebar", () => {
  it("keeps purchased-report links hidden for a client without entitlements", async () => {
    useAppStore.getState().setSession(session());
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByText("My Reports"));

    expect(
      screen.queryByRole("link", { name: "Employee Response Breakdown" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Benefits & Best Practices" }),
    ).not.toBeInTheDocument();
  });

  it("always shows Employee Verbatims even without EV_Access", async () => {
    useAppStore.getState().setSession(session());
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByText("My Reports"));

    expect(
      screen.getByRole("link", { name: "Employee Verbatims" }),
    ).toBeVisible();
  });
});
