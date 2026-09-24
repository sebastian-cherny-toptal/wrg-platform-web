import { useEffect, useRef, useState } from "react";
import { api, type BulkUserCatalog } from "./api";
import {
  bulkUserColumns,
  parseCsv,
  resolveBulkUser,
  spreadsheetRows,
  type BulkUserInput,
  type BulkUserRow,
} from "./bulk-users";

const normalized = (value: string) => value.trim().toLocaleLowerCase("en");

function comparableList(value: string): string[] {
  return value.split(",").map(normalized).filter(Boolean).sort();
}

function sameBulkValue(column: string, previous: string, next: string) {
  if (column === "Project" || column === "Program") {
    return (
      JSON.stringify(comparableList(previous)) ===
      JSON.stringify(comparableList(next))
    );
  }
  return normalized(previous) === normalized(next);
}

export function BulkUserCreation({
  onCreated,
  onClose,
  onBusyChange,
}: {
  onCreated: () => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<BulkUserCatalog>();
  const [rows, setRows] = useState<BulkUserRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let active = true;
    api
      .bulkUserCatalog()
      .then((loaded) => {
        if (active) setCatalog(loaded);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load matching data.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const resolutionCache = useRef(
    new WeakMap<
      BulkUserRow,
      {
        identityKey: string;
        result: ReturnType<typeof resolveBulkUser>;
      }
    >(),
  );
  const identityKey = rows
    .map(
      (row) =>
        `${normalized(row.input.Email)}\u0000${normalized(row.input.Username)}`,
    )
    .join("\u0001");
  const resultByRow = new Map(
    catalog
      ? rows.map((row) => {
          const cached = resolutionCache.current.get(row);
          const result =
            cached?.identityKey === identityKey
              ? cached.result
              : resolveBulkUser(
                  row,
                  catalog.roles,
                  catalog.projects,
                  catalog.organizations,
                  rows,
                  catalog.users,
                );
          resolutionCache.current.set(row, { identityKey, result });
          return [row, result] as const;
        })
      : [],
  );
  const resolve = (row: BulkUserRow) => resultByRow.get(row)!;
  const pending = rows.filter((row) => !row.outcome);
  const blocked =
    !catalog ||
    !pending.length ||
    pending.some((row) => resolve(row).errors.length);
  const downloadTemplate = () => {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + bulkUserColumns.join(",") + "\r\n"], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "users-bulk-creation-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const desiredValues = (
    row: BulkUserRow,
    result: ReturnType<typeof resolve>,
  ): BulkUserInput => {
    const selectedPrograms = result.programIds.map((id) => {
      for (const project of catalog!.projects) {
        const program = project.programs.find((item) => item.id === id);
        if (program) return { name: program.name, projectName: project.name };
      }
      return { name: id, projectName: "" };
    });
    const programNames = selectedPrograms.map(({ name }) => name);
    const inferredProjectNames = [
      ...new Set(
        selectedPrograms.flatMap(({ projectName }) =>
          projectName ? [projectName] : [],
        ),
      ),
    ];
    return {
      ...row.input,
      Role:
        result.options.Role.find((option) => option.id === result.selected.Role)
          ?.key ?? row.input.Role,
      Project:
        result.options.Project.find(
          (option) => option.id === result.selected.Project,
        )?.label ??
        (result.supportsOrganizationPrograms && inferredProjectNames.length
          ? inferredProjectNames.join(", ")
          : row.input.Project),
      Program: programNames.join(", "),
      Organization:
        result.options.Organization.find(
          (option) => option.id === result.selected.Organization,
        )?.label ?? row.input.Organization,
    };
  };
  const previousValues = (
    result: ReturnType<typeof resolveBulkUser>,
  ): BulkUserInput | null => {
    const existing = result.existingUser;
    if (!existing) return null;
    return {
      "Full Name": existing.fullName,
      Email: existing.email,
      Username: existing.username ?? "",
      Role: existing.role ?? "",
      Project: existing.projects.map((project) => project.name).join(", "),
      Program: existing.programDetails
        .map((program) => program.name)
        .join(", "),
      Organization: existing.organization?.name ?? "",
      Mobile: existing.mobile ?? "",
    };
  };
  const changedColumns = (
    row: BulkUserRow,
    result: ReturnType<typeof resolve>,
  ) => {
    const previous = previousValues(result);
    if (!previous) return [];
    const desired = desiredValues(row, result);
    return bulkUserColumns.filter(
      (column) =>
        column !== "Username" &&
        !sameBulkValue(column, previous[column], desired[column]),
    );
  };
  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    setRows([]);
    setFilename(file.name);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Maximum file size is 5 MB.");
      let data: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        data = await readSheet(file);
      } else if (/\.csv$/i.test(file.name)) data = parseCsv(await file.text());
      else throw new Error("Choose an XLSX or CSV spreadsheet.");
      setRows(spreadsheetRows(data));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to read spreadsheet.",
      );
    } finally {
      setBusy(false);
    }
  };
  const processRows = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError("");
    let completedCount = 0;
    for (const row of pending) {
      const result = resolve(row);
      try {
        let outcome: BulkUserRow["outcome"];
        if (result.existingUser) {
          if (!changedColumns(row, result).length) {
            outcome = "unchanged";
          } else {
            await api.updateUser(result.existingUser.id, {
              fullName: row.input["Full Name"],
              email: row.input.Email,
              username: row.input.Username,
              mobile: row.input.Mobile,
              roleId: result.selected.Role,
              ...(result.isClient
                ? {}
                : {
                    projects: result.selected.Project
                      ? [result.selected.Project]
                      : [],
                  }),
              programs: result.supportsOrganizationPrograms
                ? result.programIds
                : [],
              ...(result.supportsOrganizationPrograms &&
              result.selected.Organization
                ? { organizationId: result.selected.Organization }
                : {}),
            });
            outcome = "updated";
          }
        } else {
          await api.createUser({
            fullName: row.input["Full Name"],
            email: row.input.Email,
            username: row.input.Username,
            mobile: row.input.Mobile,
            roleId: result.selected.Role,
            projects: result.selected.Project ? [result.selected.Project] : [],
            ...(result.supportsOrganizationPrograms
              ? {
                  programs: result.programIds,
                  ...(result.selected.Organization
                    ? { organizationId: result.selected.Organization }
                    : {}),
                }
              : {}),
          });
          outcome = "created";
        }
        completedCount++;
        setRows((current) =>
          current.map((item) =>
            item === row
              ? {
                  ...item,
                  created: outcome === "created",
                  outcome,
                  error: undefined,
                }
              : item,
          ),
        );
      } catch (caught) {
        setRows((current) =>
          current.map((item) =>
            item === row
              ? {
                  ...item,
                  error:
                    caught instanceof Error
                      ? caught.message
                      : "Unable to create user.",
                }
              : item,
          ),
        );
      }
    }
    if (completedCount) onCreated();
    setBusy(false);
  };
  const edit = (
    row: BulkUserRow,
    column: string,
    value: string,
    selection = false,
  ) =>
    setRows((current) =>
      current.map((item) =>
        item === row
          ? {
              ...item,
              error: undefined,
              ...(selection
                ? { selected: { ...item.selected, [column]: value } }
                : { input: { ...item.input, [column]: value }, selected: {} }),
            }
          : item,
      ),
    );
  return (
    <div className="bulk-user-creation">
      <p>
        Upload an XLSX or CSV with one user per row. XLSX uploads use the first
        sheet. Full Name, Email, Username and Role are required. Use one Project
        per row and separate multiple Program names with commas. In CSV files,
        quote a Program cell containing commas. Client users also require
        Organization and at least one enrolled Program. Organization and Program
        are optional for Promotional users. An existing Username updates that
        user. Mobile is optional.
      </p>
      <div className="bulk-upload-actions">
        <label className="upload-card">
          <strong>Upload spreadsheet</strong>
          <span>{filename || "XLSX or CSV · up to 500 users · 5 MB"}</span>
          <input
            aria-label="Upload users spreadsheet"
            type="file"
            accept=".xlsx,.csv"
            disabled={busy || !catalog || rows.some((row) => row.outcome)}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={downloadTemplate}
        >
          Download template
        </button>
      </div>
      {!catalog && !error ? (
        <p role="status">
          Loading projects, programs, organizations and roles…
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {catalog && rows.length ? (
        <>
          <p role="status">
            {rows.filter((row) => row.outcome).length} completed ·{" "}
            {pending.length} remaining. Resolve all flagged rows before
            processing. Completed rows will be skipped when retrying.
          </p>
          {rows.map((row) => {
            const result = resolve(row);
            const previous = previousValues(result);
            const desired = desiredValues(row, result);
            const changes = new Set(changedColumns(row, result));
            return (
              <fieldset
                key={row.rowNumber}
                disabled={busy || Boolean(row.outcome)}
                className="bulk-user-row"
              >
                <legend>
                  Row {row.rowNumber}
                  {row.outcome
                    ? ` · ${
                        row.outcome === "created"
                          ? "Created"
                          : row.outcome === "updated"
                            ? "Updated"
                            : "No changes"
                      }`
                    : result.existingUser
                      ? " · Existing user"
                      : " · New user"}
                </legend>
                <div className="bulk-user-fields">
                  {bulkUserColumns.map((column) => (
                    <label key={column}>
                      {column}
                      <input
                        aria-label={`Row ${row.rowNumber} ${column}`}
                        value={row.input[column]}
                        onChange={(event) =>
                          edit(row, column, event.target.value)
                        }
                      />
                      {previous && changes.has(column) ? (
                        <span className="zoho-resync-value bulk-user-change">
                          <del>{previous[column] || "—"}</del>
                          <span>{desired[column] || "—"}</span>
                        </span>
                      ) : null}
                      {column === "Program"
                        ? result.programTokens.map((token, index) => {
                            const key = `Program:${index}`;
                            const matches = result.options[key] ?? [];
                            return matches.length > 1 ? (
                              <select
                                aria-label={`Row ${row.rowNumber} select Program ${token}`}
                                key={key}
                                value={result.selected[key]}
                                onChange={(event) =>
                                  edit(row, key, event.target.value, true)
                                }
                              >
                                <option value="">
                                  Select a match for {token}…
                                </option>
                                {matches.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label} · {option.key} · {option.id}
                                  </option>
                                ))}
                              </select>
                            ) : null;
                          })
                        : null}
                      {column !== "Program" &&
                      (result.options[column]?.length ?? 0) > 1 ? (
                        <select
                          aria-label={`Row ${row.rowNumber} select ${column}`}
                          value={result.selected[column]}
                          onChange={(event) =>
                            edit(row, column, event.target.value, true)
                          }
                        >
                          <option value="">Select a match…</option>
                          {result.options[column].map((option) => {
                            return (
                              <option key={option.id} value={option.id}>
                                {option.label}· {option.id}
                              </option>
                            );
                          })}
                        </select>
                      ) : null}
                    </label>
                  ))}
                </div>
                {!row.outcome && result.errors.length ? (
                  <ul className="form-error">
                    {result.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
                {row.error ? (
                  <p className="form-error" role="alert">
                    {row.error}
                  </p>
                ) : null}
                {!row.outcome && !row.error && !result.errors.length ? (
                  <p>
                    {result.existingUser
                      ? changes.size
                        ? `Ready to update · ${changes.size} changed field${changes.size === 1 ? "" : "s"}`
                        : "Ready · no changes"
                      : "Ready to create"}
                  </p>
                ) : null}
              </fieldset>
            );
          })}
        </>
      ) : null}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy || blocked}
          onClick={() => void processRows()}
        >
          {busy ? "Processing…" : `Process ${pending.length} users`}
        </button>
      </div>
    </div>
  );
}
