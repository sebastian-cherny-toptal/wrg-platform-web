import { useEffect, useState } from "react";
import {
  api,
  type OrganizationRecord,
  type ProjectRecord,
  type UserRecord,
} from "./api";
import {
  bulkUserColumns,
  parseCsv,
  resolveBulkUser,
  spreadsheetRows,
  type BulkUserRow,
} from "./bulk-users";

export function BulkUserCreation({
  onCreated,
  onClose,
  onBusyChange,
}: {
  onCreated: () => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<{
    roles: Record<string, unknown>[];
    projects: ProjectRecord[];
    organizations: OrganizationRecord[];
    users: UserRecord[];
  }>();
  const [rows, setRows] = useState<BulkUserRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let active = true;
    Promise.all([api.roles(), api.projects(), api.organizations(), api.users()])
      .then(([roles, projects, organizations, users]) => {
        if (active) setCatalog({ roles, projects, organizations, users });
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
  const resolve = (row: BulkUserRow) =>
    resolveBulkUser(
      row,
      catalog!.roles,
      catalog!.projects,
      catalog!.organizations,
      rows,
      catalog!.users,
    );
  const pending = rows.filter((row) => !row.created);
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
  const create = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError("");
    let createdCount = 0;
    for (const row of pending) {
      const result = resolve(row);
      try {
        await api.createUser({
          fullName: row.input["Full Name"],
          email: row.input.Email,
          username: row.input.Username,
          mobile: row.input.Mobile,
          roleId: result.selected.Role,
          projects: result.selected.Project ? [result.selected.Project] : [],
          ...(result.isClient
            ? {
                organizationId: result.selected.Organization,
                programs: [result.selected.Program],
              }
            : {}),
        });
        createdCount++;
        setRows((current) =>
          current.map((item) =>
            item === row ? { ...item, created: true, error: undefined } : item,
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
    if (createdCount) onCreated();
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
        and Program name per row. Client and Promotional users also require
        Organization and an enrolled Program. Mobile is optional.
      </p>
      <div className="bulk-upload-actions">
        <label className="upload-card">
          <strong>Upload spreadsheet</strong>
          <span>{filename || "XLSX or CSV · up to 500 users · 5 MB"}</span>
          <input
            aria-label="Upload users spreadsheet"
            type="file"
            accept=".xlsx,.csv"
            disabled={busy || !catalog || rows.some((row) => row.created)}
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
            {rows.filter((row) => row.created).length} created ·{" "}
            {pending.length} remaining. Resolve all flagged rows before
            creation. Created rows will be skipped when retrying.
          </p>
          {rows.map((row) => {
            const result = resolve(row);
            return (
              <fieldset
                key={row.rowNumber}
                disabled={busy || row.created}
                className="bulk-user-row"
              >
                <legend>
                  Row {row.rowNumber}
                  {row.created ? " · Created" : ""}
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
                      {(result.options[column]?.length ?? 0) > 1 ? (
                        <select
                          aria-label={`Row ${row.rowNumber} select ${column}`}
                          value={result.selected[column]}
                          onChange={(event) =>
                            edit(row, column, event.target.value, true)
                          }
                        >
                          <option value="">Select a match…</option>
                          {result.options[column].map((option) => {
                            const program = catalog.projects
                              .flatMap((project) =>
                                project.programs.map((item) => ({
                                  ...item,
                                  projectName: project.name,
                                })),
                              )
                              .find((item) => item.id === option.id);
                            return (
                              <option key={option.id} value={option.id}>
                                {option.label}
                                {column === "Program" && program
                                  ? ` · ${program.projectName} · ${program.year ?? "No year"}`
                                  : ""}{" "}
                                · {option.id}
                              </option>
                            );
                          })}
                        </select>
                      ) : null}
                    </label>
                  ))}
                </div>
                {!row.created && result.errors.length ? (
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
                {!row.created && !row.error && !result.errors.length ? (
                  <p>Ready to create</p>
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
          onClick={() => void create()}
        >
          {busy ? "Processing…" : `Create ${pending.length} users`}
        </button>
      </div>
    </div>
  );
}
