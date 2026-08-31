import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./schemas";
import { api, cachePurchasedReportAccess } from "./client";
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
  it("does not grant Employee Verbatims with the standard package", () => {
    const purchaseSession: Session = {
      ...session,
      user: {
        ...session.user,
        programs: [
          {
            id: "program-2026",
            name: "2026 program",
            year: 2026,
            organizationName: "Example Client",
            entitlements: {},
          },
        ],
      },
    };
    useAppStore.getState().setSession(purchaseSession);
    useAppStore.getState().selectProgram("program-2026");

    cachePurchasedReportAccess([
      {
        productId: "report-standard-package",
        name: "The Feedback Data Dashboard",
      },
    ]);

    expect(
      useAppStore.getState().session?.user.programs[0]?.entitlements,
    ).toEqual({
      WFR_Access: "yes",
      WBC_Access: "yes",
      BBP_Access: "yes",
    });
  });

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

  it("keeps a paid sorted-verbatims purchase and its category visible before webhook reconciliation", async () => {
    const purchaseSession: Session = {
      ...session,
      user: {
        ...session.user,
        programs: [{
          id: "program-2026",
          name: "2026 program",
          year: 2026,
          organizationName: "Example Client",
          entitlements: { EV_Access: "yes" },
        }],
      },
    };
    useAppStore.getState().setSession(purchaseSession);
    cachePurchasedReportAccess([{
      productId: "report-verbatims-sorted",
      name: "Sorted Employee Verbatims",
      keys: { EV_Sorting_Filter: "department" },
    }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        id: "report-verbatims-sorted",
        name: "Sorted Employee Verbatims",
        description: "Sort responses",
        priceCents: 42_500,
        available: true,
        purchaseMode: "checkout",
        fulfillment: "instant",
        requiresStandardPackage: true,
        priceAvailable: true,
        owned: false,
        standardPackageOwned: true,
        purchasable: true,
        deliveryMessage: "Instant access",
      }]),
    }));

    const products = await api.reports.catalog("program-2026");

    expect(products[0]).toMatchObject({ owned: true, selection: "department" });
    expect(useAppStore.getState().session?.user.programs[0]).toMatchObject({
      entitlements: { SEV_Access: "yes" },
      reportSelections: { SEV_Filter: "department" },
    });
  });
});
