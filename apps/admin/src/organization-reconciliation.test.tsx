import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type OrganizationReconciliationReport,
  type OrganizationReconciliationRow,
  type ReconciliationOrganization,
} from "./api";
import { OrganizationReconciliation } from "./organization-reconciliation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const organization = (
  id: string,
  account: string | null,
): ReconciliationOrganization => ({
  id,
  name: "Rio Grande Regional Hospital",
  zohoAccountId: account,
  legacyId: null,
  externalId: null,
  stripeCustomerId: null,
  counts: {
    programs: 1,
    users: 2,
    respondents: 83,
    responses: 2490,
    orders: 1,
    assets: 0,
    auditLogs: 1,
    impersonationGrants: 0,
    keyImpactAnalysisRows: 4,
    keyImpactAnalysisUploads: 1,
    customReportUploads: 1,
  },
  programs: [
    {
      enrollmentId: `enrollment-${id}`,
      programId: `program-${id}`,
      programName: `Healthcare ${account ? "2025" : "2026"}`,
      year: account ? 2025 : 2026,
      projectName: "Healthcare",
      sourceId: "243",
      sourceName: "Rio Grande Regional Hospital",
    },
  ],
});
const row = (index = 1, blocked = false): OrganizationReconciliationRow => ({
  id: `conflict-${index}`,
  organizationProgramId: `enrollment-${index}`,
  sourceOrganizationId: `source-${index}`,
  sourceOrganizationName: "Rio Grande Regional Hospital",
  savedZohoAccountId: null,
  sourceId: String(index),
  zohoOrganizationName: "Rio Grande Regional Hospital",
  zohoAccountId: `506645300009312818${index}`,
  matchedBy: "sourceId",
  targetOrganizationId: `target-${index}`,
  targetOrganizationName: "Rio Grande Regional Hospital",
  reasons: ["Zoho account is already linked to the destination organization"],
  source: organization(`source-${index}`, null),
  target: organization(`target-${index}`, `account-${index}`),
  blockers: blocked
    ? [
        "Both organizations are enrolled in Healthcare 2026. Resolve the duplicate enrollments before merging.",
      ]
    : [],
  eligible: !blocked,
});
const report = (
  rows = [row(), row(2, true)],
): OrganizationReconciliationReport => ({
  programId: "program",
  revision: "a".repeat(64),
  conflicts: rows,
});

function setup(rows?: OrganizationReconciliationRow[]) {
  const data = report(rows);
  const load = vi
    .spyOn(api, "organizationReconciliationReport")
    .mockResolvedValue(data);
  const preview = {
    programId: "program",
    revision: "b".repeat(64),
    conflictIds: ["conflict-1"],
    merges: [data.conflicts[0]],
  };
  const review = vi
    .spyOn(api, "previewOrganizationReconciliation")
    .mockResolvedValue(preview);
  const apply = vi
    .spyOn(api, "applyOrganizationReconciliation")
    .mockResolvedValue({ programId: "program", appliedCount: 1 });
  const onApplied = vi.fn().mockResolvedValue(undefined);
  render(
    <OrganizationReconciliation programId="program" onApplied={onApplied} />,
  );
  return { data, load, preview, review, apply, onApplied };
}

describe("organization reconciliation", () => {
  it("loads read-only, shows both histories, and disables blocked pairs", async () => {
    const { review, apply } = setup();
    expect(
      await screen.findByText(
        "2 conflicts · 1 eligible for review · 1 blocked",
      ),
    ).toBeTruthy();
    expect(screen.getByText("source-1")).toBeTruthy();
    expect(screen.getByText("target-1")).toBeTruthy();
    expect(screen.getAllByText(/Healthcare 2025/)).toHaveLength(2);
    expect(screen.getByText(/Both organizations are enrolled/)).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", { name: /source-2/ }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Preview reconciliation (0)",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(review).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("previews selected repairs and requires verification before applying the server revision", async () => {
    const { review, apply, load, onApplied, preview } = setup();
    fireEvent.click(await screen.findByRole("checkbox", { name: /source-1/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preview reconciliation (1)" }),
    );
    const panel = await screen.findByRole("region", {
      name: "Reconciliation preview",
    });
    expect(review).toHaveBeenCalledWith("program", ["conflict-1"]);
    expect(
      within(panel).getByText(/This affects all its programs and years/),
    ).toBeTruthy();
    const applyButton = within(panel).getByRole("button", {
      name: "Apply reconciliations",
    });
    expect((applyButton as HTMLButtonElement).disabled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(
      within(panel).getByRole("checkbox", { name: /I verified/ }),
    );
    load.mockResolvedValue(report([]));
    fireEvent.click(applyButton);
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith(
        "program",
        ["conflict-1"],
        preview.revision,
      ),
    );
    expect(
      await screen.findByText(/Reconciled 1 duplicate organization/),
    ).toBeTruthy();
    expect(
      await screen.findByText(/No organization account conflicts/),
    ).toBeTruthy();
    expect(onApplied).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("region", { name: "Reconciliation preview" }),
    ).toBeNull();
  });

  it("discards stale previews and requires a fresh preview after an apply error", async () => {
    const { apply, onApplied } = setup();
    apply.mockRejectedValue(
      new Error(
        "Reconciliation data changed; refresh the report and preview again",
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Select all 1 eligible conflict",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preview reconciliation (1)" }),
    );
    const panel = await screen.findByRole("region", {
      name: "Reconciliation preview",
    });
    fireEvent.click(
      within(panel).getByRole("checkbox", { name: /I verified/ }),
    );
    fireEvent.click(
      within(panel).getByRole("button", { name: "Apply reconciliations" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "data changed",
    );
    expect(
      screen.queryByRole("button", { name: "Apply reconciliations" }),
    ).toBeNull();
    expect(onApplied).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("selects eligible conflicts across pages and keeps selection visible while filtering", async () => {
    const { review } = setup(
      Array.from({ length: 12 }, (_, index) => row(index + 1, index === 11)),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Select all 11 eligible conflicts",
      }),
    );
    expect(screen.getByText(/11 selected across all pages/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next conflicts" }));
    expect(
      (screen.getByRole("checkbox", { name: /source-11/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: /source-12/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Show conflicts"), {
      target: { value: "blocked" },
    });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Preview reconciliation (11)" }),
    );
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith(
        "program",
        Array.from({ length: 11 }, (_, index) => `conflict-${index + 1}`),
      ),
    );
  });

  it("keeps report failures recoverable without enabling repairs", async () => {
    vi.spyOn(api, "organizationReconciliationReport")
      .mockRejectedValueOnce(new Error("Zoho unavailable"))
      .mockResolvedValue(report([]));
    const apply = vi.spyOn(api, "applyOrganizationReconciliation");
    render(
      <OrganizationReconciliation
        programId="program"
        onApplied={async () => {}}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Zoho unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh report" }));
    expect(
      await screen.findByText(/No organization account conflicts/),
    ).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
  });
});
