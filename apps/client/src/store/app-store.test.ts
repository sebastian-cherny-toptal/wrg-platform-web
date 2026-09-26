import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "../api/schemas";
import { hasEntitlement, useAppStore } from "./app-store";

const session = {
  user: {
    id: "user-1",
    displayName: "Test user",
    email: "test@example.test",
    role: "client",
    permissions: [],
    programs: [2024, 2026, 2025].map((year) => ({
      id: `program-${year}`,
      name: `${year} program`,
      year,
      organizationName: "Test organization",
      entitlements: { WFR_Access: "yes" as const },
    })),
  },
  expiresAt: "2027-01-01T00:00:00.000Z",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  impersonation: null,
} satisfies Session;

describe("app store program selection", () => {
  beforeEach(() => {
    useAppStore.setState({ session: null, selectedProgramId: null, cart: [] });
  });

  it("selects the latest available program when a session is established", () => {
    useAppStore.getState().setSession(session);
    expect(useAppStore.getState().selectedProgramId).toBe("program-2026");
  });

  it("allows one login to be promotional for one year and client for another", () => {
    useAppStore.getState().setSession({
      ...session,
      user: {
        ...session.user,
        programs: session.user.programs.map((program) => ({
          ...program,
          accessMode:
            program.year === 2026
              ? ("promotional" as const)
              : ("client" as const),
        })),
      },
    });

    expect(hasEntitlement("WFR_Access")).toBe(false);
    useAppStore.getState().selectProgram("program-2025");
    expect(hasEntitlement("WFR_Access")).toBe(true);
  });
});
