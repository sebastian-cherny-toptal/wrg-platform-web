import type { OrganizationRecord, ProjectRecord, UserRecord } from "./api";
import { field } from "./api";

export const bulkUserColumns = [
  "Full Name",
  "Email",
  "Username",
  "Role",
  "Project",
  "Program",
  "Organization",
  "Mobile",
];
export type BulkUserInput = Record<(typeof bulkUserColumns)[number], string>;
export type MatchOption = { id: string; label: string; key?: string };
export type BulkUserRow = {
  rowNumber: number;
  input: BulkUserInput;
  selected: Record<string, string>;
  created?: boolean;
  error?: string;
};
const normalize = (value: string) => value.trim().toLowerCase();

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw new Error("Invalid CSV quoting.");
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell);
      cell = "";
      if (char !== ",") {
        rows.push(row);
        row = [];
        if (char === "\r" && text[index + 1] === "\n") index++;
      }
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

export function spreadsheetRows(data: unknown[][]): BulkUserRow[] {
  const headers = (data[0] ?? []).map((value) =>
    normalize(String(value ?? "").replace(/^\uFEFF/, "")),
  );
  for (const required of bulkUserColumns.slice(0, 4)) {
    if (!headers.includes(normalize(required)))
      throw new Error(`Missing column: ${required}`);
  }
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length)
    throw new Error("Duplicate column headers are not allowed.");
  const rows = data.slice(1).flatMap((values, index) => {
    if (values.every((value) => !String(value ?? "").trim())) return [];
    const input = Object.fromEntries(
      bulkUserColumns.map((column) => [
        column,
        String(values[headers.indexOf(normalize(column))] ?? "").trim(),
      ]),
    ) as BulkUserInput;
    return [{ rowNumber: index + 2, input, selected: {} }];
  });
  if (!rows.length)
    throw new Error(
      "The spreadsheet has no users. Add one user per row below the headers.",
    );
  if (rows.length > 500) throw new Error("Upload at most 500 users at a time.");
  return rows;
}

export function resolveBulkUser(
  row: BulkUserRow,
  roles: Record<string, unknown>[],
  projects: ProjectRecord[],
  organizations: OrganizationRecord[],
  rows: BulkUserRow[],
  users: UserRecord[],
) {
  const errors: string[] = [];
  const options: Record<string, MatchOption[]> = {};
  const selected: Record<string, string> = {};
  const match = (
    column: string,
    candidates: MatchOption[],
    required = false,
  ) => {
    const name = normalize(row.input[column] ?? "");
    options[column] = name
      ? candidates.filter(
          (item) =>
            normalize(item.label) === name ||
            normalize(item.key ?? "") === name,
        )
      : [];
    const matches = options[column];
    selected[column] = matches.some((item) => item.id === row.selected[column])
      ? row.selected[column]
      : matches.length === 1
        ? matches[0].id
        : "";
    if (!name && required) errors.push(`${column} is required.`);
    else if (name && !matches.length)
      errors.push(`${column}: no match for “${row.input[column]}”.`);
    else if (matches.length > 1 && !selected[column])
      errors.push(`${column}: select one of ${matches.length} matches.`);
  };
  for (const column of ["Full Name", "Email", "Username"])
    if (!row.input[column].trim()) errors.push(`${column} is required.`);
  if (row.input.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.input.Email))
    errors.push("Email is invalid.");
  for (const column of ["Email", "Username"] as const) {
    const value = normalize(row.input[column]);
    if (
      value &&
      (rows.some(
        (other) => other !== row && normalize(other.input[column]) === value,
      ) ||
        users.some(
          (user) =>
            normalize(
              (column === "Email" ? user.email : user.username) ?? "",
            ) === value,
        ))
    )
      errors.push(`${column} already exists or is duplicated in this upload.`);
  }
  match(
    "Role",
    roles.map((role) => ({
      id: field(role, "_id", "id"),
      label: field(role, "name", "role"),
      key: field(role, "role"),
    })),
    true,
  );
  const role = options.Role.find((item) => item.id === selected.Role);
  const isClient = ["client", "promotional"].includes(role?.key ?? "");
  match(
    "Project",
    projects.map((project) => ({ id: project.id, label: project.name })),
  );
  match(
    "Organization",
    organizations.map((organization) => ({
      id: organization.selectionId,
      label: organization.name,
    })),
    isClient,
  );
  const organization = organizations.find(
    (item) => item.selectionId === selected.Organization,
  );
  const programs = isClient
    ? (organization?.programs ?? [])
    : projects.flatMap((project) =>
        project.programs.map((program) => ({
          ...program,
          projectId: project.id,
        })),
      );
  match(
    "Program",
    programs
      .filter(
        (program) =>
          !selected.Project || program.projectId === selected.Project,
      )
      .map((program) => ({ id: program.id, label: program.name })),
    isClient,
  );
  if (role && !isClient && (row.input.Organization || row.input.Program))
    errors.push(
      "Organization and Program are only supported for Client and Promotional roles.",
    );
  return { errors, options, selected, isClient };
}
