import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./schemas";
import { api } from "./client";
import { useAppStore } from "../store/app-store";

const session: Session = {
  user: {
    id: "client-id",
    displayName: "Example Client",
    email: "client@example.com",
    role: "client",
    permissions: [],
    programs: [],
  },
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  verifiedAt: new Date().toISOString(),
  impersonation: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAppStore.getState().setSession(null);
});

describe("client session expiration", () => {
  it("closes every frontend session when a token-authenticated request returns 401", async () => {
    window.localStorage.setItem("wrg-client-access-token", "client-token");
    window.localStorage.setItem("wrg-client-session", JSON.stringify(session));
    window.sessionStorage.setItem(
      "wrg-impersonation-token",
      "expired-impersonation-token",
    );
    window.sessionStorage.setItem(
      "wrg-impersonation-session",
      JSON.stringify(session),
    );
    useAppStore.getState().setSession(session);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.reports.catalog()).rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem("wrg-client-access-token")).toBeNull();
    expect(window.localStorage.getItem("wrg-client-session")).toBeNull();
    expect(window.sessionStorage.getItem("wrg-impersonation-token")).toBeNull();
    expect(window.sessionStorage.getItem("wrg-impersonation-session")).toBeNull();
    expect(useAppStore.getState().session).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestOptions] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(new Headers(requestOptions.headers).get("Authorization")).toBe(
      "Bearer expired-impersonation-token",
    );
  });
});
