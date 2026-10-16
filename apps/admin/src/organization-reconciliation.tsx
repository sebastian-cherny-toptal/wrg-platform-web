import { useEffect, useState } from "react";
import {
  api,
  type OrganizationReconciliationPreview,
  type OrganizationReconciliationReport,
  type ReconciliationOrganization,
} from "./api";

function quantity(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function OrganizationDetails({
  organization,
}: {
  organization: ReconciliationOrganization | null;
}) {
  if (!organization) return <span>No verified destination</span>;
  const counts = organization.counts;
  return (
    <div className="reconciliation-organization">
      <strong>{organization.name}</strong>
      <code>{organization.id}</code>
      <span>Zoho account: {organization.zohoAccountId || "Unlinked"}</span>
      <span>
        {[
          quantity(counts.programs, "program"),
          quantity(counts.users, "user"),
          quantity(counts.respondents, "respondent"),
          quantity(counts.responses, "response"),
          quantity(counts.orders, "order"),
        ].join(" · ")}
      </span>
      <details>
        <summary>Programs and associated data</summary>
        <p>
          {counts.customReportUploads} custom reports ·{" "}
          {counts.keyImpactAnalysisUploads} KIA uploads ·{" "}
          {counts.keyImpactAnalysisRows} KIA rows · {counts.assets} assets ·{" "}
          {counts.auditLogs} audit entries · {counts.impersonationGrants}{" "}
          dashboard preview grants
        </p>
        <p>
          Legacy ID: {organization.legacyId || "None"} · External ID:{" "}
          {organization.externalId || "None"} · Stripe customer:{" "}
          {organization.stripeCustomerId || "None"}
        </p>
        <ul>
          {organization.programs.map((program) => (
            <li key={program.enrollmentId}>
              {program.projectName} / {program.programName} (
              {program.year ?? "Year unspecified"})
              <br />
              Source organization: {program.sourceName} · ID{" "}
              {program.sourceId || "Not provided"}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function OrganizationReconciliation({
  programId,
  disabled = false,
  onApplied,
  onBusyChange,
}: {
  programId: string;
  disabled?: boolean;
  onApplied: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [report, setReport] = useState<OrganizationReconciliationReport | null>(
    null,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] =
    useState<OrganizationReconciliationPreview | null>(null);
  const [verified, setVerified] = useState(false);
  const [action, setAction] = useState<"report" | "preview" | "apply" | null>(
    "report",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const busy = action !== null || disabled;
  useEffect(() => {
    onBusyChange?.(action !== null);
  }, [action, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => {
    let active = true;
    void api
      .organizationReconciliationReport(programId)
      .then((next) => {
        if (active) setReport(next);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Conflict report could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setAction(null);
      });
    return () => {
      active = false;
    };
  }, [programId]);
  const refresh = async () => {
    setAction("report");
    setError("");
    setPreview(null);
    setVerified(false);
    setSelected([]);
    try {
      setReport(await api.organizationReconciliationReport(programId));
    } catch (caught) {
      setReport(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Conflict report could not be loaded.",
      );
    } finally {
      setAction(null);
    }
  };
  const review = async () => {
    setAction("preview");
    setError("");
    setNotice("");
    setVerified(false);
    try {
      setPreview(
        await api.previewOrganizationReconciliation(programId, selected),
      );
    } catch (caught) {
      setPreview(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Reconciliation preview could not be loaded.",
      );
    } finally {
      setAction(null);
    }
  };
  const apply = async () => {
    if (!preview || !verified || busy) return;
    setAction("apply");
    setError("");
    let applied = false;
    try {
      const result = await api.applyOrganizationReconciliation(
        programId,
        preview.conflictIds,
        preview.revision,
      );
      applied = true;
      setNotice(
        `Reconciled ${result.appliedCount} duplicate organization${result.appliedCount === 1 ? "" : "s"}. Run Re-Sync All Deals to review Zoho changes.`,
      );
      setPreview(null);
      setVerified(false);
      setSelected([]);
      setReport(null);
      await onApplied();
      setReport(await api.organizationReconciliationReport(programId));
    } catch (caught) {
      setPreview(null);
      setVerified(false);
      setError(
        applied
          ? "Reconciliation was applied, but the view could not refresh. Refresh the report before continuing."
          : caught instanceof Error
            ? caught.message
            : "Reconciliation could not be applied.",
      );
    } finally {
      setAction(null);
    }
  };
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `organization-account-conflicts-${report.programId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  const eligible = report?.conflicts.filter((row) => row.eligible) ?? [];
  const query = search.toLowerCase();
  const rows = (report?.conflicts ?? []).filter(
    (row) =>
      (filter === "all" ||
        (filter === "eligible" ? row.eligible : !row.eligible)) &&
      [
        row.sourceOrganizationName,
        row.sourceOrganizationId,
        row.targetOrganizationName,
        row.targetOrganizationId,
        row.zohoAccountId,
        row.sourceId,
      ].some((value) => value?.toLowerCase().includes(query)),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return (
    <section
      className="program-sync-panel reconciliation-panel"
      aria-labelledby="reconciliation-title"
    >
      <h3 id="reconciliation-title">Organization account conflict report</h3>
      <p>
        This report is read-only. Select verified duplicates to preview a
        repair. Matching names alone do not establish that two organizations are
        the same company.
      </p>
      <div className="program-sync-actions">
        <button
          className="secondary-button compact"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh report
        </button>
        <button
          className="secondary-button compact"
          disabled={!report || busy}
          onClick={download}
        >
          Download report
        </button>
      </div>
      {action ? (
        <p role="status">
          {action === "report"
            ? "Loading conflict report…"
            : action === "preview"
              ? "Validating selected repairs…"
              : "Applying reconciliations…"}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="program-sync-status" role="status">
          {notice}
        </p>
      ) : null}
      {report ? (
        <>
          <p>
            {quantity(report.conflicts.length, "conflict")} · {eligible.length}{" "}
            eligible for review · {report.conflicts.length - eligible.length}{" "}
            blocked
          </p>
          {report.conflicts.length === 0 ? (
            <p>
              No organization account conflicts were found for this program.
            </p>
          ) : (
            <>
              <div className="reconciliation-filters">
                <label>
                  Search conflicts
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Organization, account or source ID"
                  />
                </label>
                <label>
                  Show conflicts
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All conflicts</option>
                    <option value="eligible">Eligible for review</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
              </div>
              <div className="program-sync-actions">
                <button
                  className="secondary-button compact"
                  disabled={busy || !!preview || !eligible.length}
                  onClick={() => setSelected(eligible.map((row) => row.id))}
                >
                  Select all {quantity(eligible.length, "eligible conflict")}
                </button>
                <button
                  className="secondary-button compact"
                  disabled={busy || !!preview || !selected.length}
                  onClick={() => setSelected([])}
                >
                  Clear selection
                </button>
                <button
                  className="primary-button compact"
                  disabled={busy || !!preview || !selected.length}
                  onClick={() => void review()}
                >
                  Preview reconciliation ({selected.length})
                </button>
              </div>
              <div className="table-card reconciliation-table">
                <table>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Enrolled organization (proposed duplicate)</th>
                      <th>Keep organization (Zoho account owner)</th>
                      <th>Zoho match and status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .slice((currentPage - 1) * 10, currentPage * 10)
                      .map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.sourceOrganizationName} (${row.sourceOrganizationId})`}
                              checked={selected.includes(row.id)}
                              disabled={busy || !!preview || !row.eligible}
                              onChange={(event) =>
                                setSelected((previous) =>
                                  event.target.checked
                                    ? [...previous, row.id]
                                    : previous.filter((id) => id !== row.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <OrganizationDetails organization={row.source} />
                          </td>
                          <td>
                            <OrganizationDetails organization={row.target} />
                          </td>
                          <td>
                            <div className="reconciliation-organization">
                              <strong>
                                {row.zohoOrganizationName ||
                                  "Unnamed Zoho organization"}
                              </strong>
                              <span>Zoho account: {row.zohoAccountId}</span>
                              <span>
                                Source ID: {row.sourceId || "Not provided"}
                              </span>
                              <span>
                                Matched by:{" "}
                                {row.matchedBy === "sourceId"
                                  ? "source organization ID"
                                  : row.matchedBy === "name"
                                    ? "organization name"
                                    : "Zoho account"}
                              </span>
                              <strong>
                                {row.eligible
                                  ? "Eligible for review"
                                  : "Blocked"}
                              </strong>
                              {row.reasons.map((reason) => (
                                <p key={reason}>{reason}</p>
                              ))}
                              {row.blockers.map((reason) => (
                                <p key={reason}>{reason}</p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 ? (
                <p>No conflicts match your filters.</p>
              ) : (
                <div className="program-sync-actions">
                  <button
                    className="secondary-button compact"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous conflicts
                  </button>
                  <span>
                    Page {currentPage} of {Math.ceil(rows.length / 10)} ·{" "}
                    {selected.length} selected across all pages
                  </span>
                  <button
                    className="secondary-button compact"
                    disabled={currentPage * 10 >= rows.length}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next conflicts
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : null}
      {preview ? (
        <section
          className="reconciliation-preview"
          aria-label="Reconciliation preview"
        >
          <h4>
            Review {preview.merges.length} organization merge
            {preview.merges.length === 1 ? "" : "s"}
          </h4>
          <p>
            Each duplicate will be removed after its data moves to the existing
            Zoho account owner. This affects all its programs and years.
            Enrollment IDs, source IDs, survey responses, report access,
            payments and uploads are preserved. Original organization details
            are recorded in the audit trail.
          </p>
          <p>
            Moved users may need to sign in again. Existing dashboard preview
            grants for those organizations will end. Zoho deal fields will be
            refreshed separately through Re-Sync All Deals.
          </p>
          <ul>
            {preview.merges.map((row) => (
              <li key={row.id}>
                <strong>{row.source?.name}</strong> ({row.sourceOrganizationId})
                → <strong>{row.target?.name}</strong> (
                {row.targetOrganizationId})
                <p>
                  Move{" "}
                  {[
                    quantity(row.source?.counts.programs ?? 0, "program"),
                    quantity(row.source?.counts.users ?? 0, "user"),
                    quantity(row.source?.counts.respondents ?? 0, "respondent"),
                    quantity(row.source?.counts.responses ?? 0, "response"),
                    quantity(row.source?.counts.orders ?? 0, "order"),
                    quantity(
                      row.source?.counts.customReportUploads ?? 0,
                      "custom report",
                    ),
                    quantity(
                      row.source?.counts.keyImpactAnalysisUploads ?? 0,
                      "KIA upload",
                    ),
                  ].join(", ")}
                  .
                </p>
              </li>
            ))}
          </ul>
          <label className="reconciliation-confirm">
            <input
              type="checkbox"
              checked={verified}
              disabled={busy}
              onChange={(event) => setVerified(event.target.checked)}
            />
            I verified that each selected pair represents the same company and
            approve merging all its programs and years.
          </label>
          <div className="program-sync-actions">
            <button
              className="secondary-button compact"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setVerified(false);
              }}
            >
              Cancel preview
            </button>
            <button
              className="primary-button compact"
              disabled={busy || !verified}
              onClick={() => void apply()}
            >
              Apply reconciliations
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
