import type { BulkUserCatalog, UserRecord } from "./api";

export const bulkUserColumns = [
  "Full Name",
  "Email",
  "Username",
  "Role",
  "Project",
  "Program",
  "Organization",
  "Mobile",
] as const;
export type BulkUserColumn = (typeof bulkUserColumns)[number];
export type BulkUserInput = Record<BulkUserColumn, string>;
export type MatchOption = { id: string; label: string; key?: string };
export type BulkUserRow = {
  rowNumber: number;
  input: BulkUserInput;
  selected: Record<string, string>;
  created?: boolean;
  outcome?: "created" | "updated" | "unchanged";
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

export function spreadsheetRows(
  data: readonly (readonly unknown[])[],
): BulkUserRow[] {
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

function csvCell(value: string): string {
  const spreadsheetSafe = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\r\n]/u.test(spreadsheetSafe)
    ? `"${spreadsheetSafe.replaceAll('"', '""')}"`
    : spreadsheetSafe;
}

export function bulkUsersCsv(users: UserRecord[]): string {
  const rows = users.map((user) => [
    user.fullName,
    user.email,
    user.username ?? "",
    user.role ?? "",
    user.projects.map((project) => project.name).join(", "),
    user.programDetails.map((program) => program.name).join(", "),
    user.organization?.name ?? "",
    user.mobile ?? "",
  ]);
  return (
    "\uFEFF" +
    [bulkUserColumns, ...rows]
      .map((values) => values.map((value) => csvCell(value)).join(","))
      .join("\r\n") +
    "\r\n"
  );
}

export function resolveBulkUser(
  row: BulkUserRow,
  roles: BulkUserCatalog["roles"],
  projects: BulkUserCatalog["projects"],
  organizations: BulkUserCatalog["organizations"],
  rows: BulkUserRow[],
  users: BulkUserCatalog["users"],
) {
  const errors: string[] = [];
  const options: Record<string, MatchOption[]> = {};
  const selected: Record<string, string> = {};
  const match = (
    column: BulkUserColumn,
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
  for (const column of ["Full Name", "Email", "Username"] as const)
    if (!row.input[column].trim()) errors.push(`${column} is required.`);
  if (row.input.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.input.Email))
    errors.push("Email is invalid.");
  const existingUser = users.find(
    (user) => normalize(user.username ?? "") === normalize(row.input.Username),
  );
  const username = normalize(row.input.Username);
  const duplicatedUsername = rows.some(
    (other) => other !== row && normalize(other.input.Username) === username,
  );
  const conflictingUser = users.some(
    (user) =>
      user.id !== existingUser?.id &&
      normalize(user.username ?? "") === username,
  );
  if (username && (duplicatedUsername || conflictingUser))
    errors.push("Username already exists or is duplicated in this upload.");
  match(
    "Role",
    roles.map((role) => ({
      id: role.id,
      label: role.name,
      key: role.key,
    })),
    true,
  );
  const role = options.Role.find((item) => item.id === selected.Role);
  const isClient = role?.key === "client";
  const supportsOrganizationPrograms = isClient || role?.key === "promotional";
  match(
    "Project",
    projects.map((project) => ({ id: project.id, label: project.name })),
  );
  const programs = projects.flatMap((project) =>
    project.programs.map((program) => ({
      ...program,
      projectId: project.id,
      projectName: project.name,
    })),
  );
  const programTokens = row.input.Program.split(",").map((value) =>
    value.trim(),
  );
  const nonEmptyProgramTokens = programTokens.filter(Boolean);
  if (isClient && !nonEmptyProgramTokens.length) {
    errors.push("Program is required.");
  }
  if (programTokens.some((value) => !value) && row.input.Program.trim()) {
    errors.push("Program contains an empty comma-separated value.");
  }
  if (
    new Set(nonEmptyProgramTokens.map(normalize)).size !==
    nonEmptyProgramTokens.length
  ) {
    errors.push("Program contains a duplicate value.");
  }
  const programIds = nonEmptyProgramTokens.flatMap((token, index) => {
    const key = `Program:${index}`;
    const matches = programs
      .filter(
        (program) =>
          (!selected.Project || program.projectId === selected.Project) &&
          normalize(program.name) === normalize(token),
      )
      .map((program) => ({
        id: program.id,
        label: program.name,
        key: `${program.projectName} · ${program.year ?? "No year"}`,
      }));
    options[key] = matches;
    const chosen = matches.some((item) => item.id === row.selected[key])
      ? row.selected[key]
      : matches.length === 1
        ? matches[0].id
        : "";
    selected[key] = chosen;
    if (index === 0) {
      options.Program = matches;
      selected.Program = chosen;
    }
    if (!matches.length) errors.push(`Program: no match for “${token}”.`);
    else if (matches.length > 1 && !chosen)
      errors.push(
        `Program “${token}”: select one of ${matches.length} matches.`,
      );
    return chosen ? [chosen] : [];
  });
  const programsResolved = programIds.length === nonEmptyProgramTokens.length;
  match(
    "Organization",
    organizations
      .filter(
        (organization) =>
          !supportsOrganizationPrograms ||
          !programsResolved ||
          programIds.every((programId) =>
            organization.programIds.includes(programId),
          ),
      )
      .map((organization) => ({
        id: organization.id,
        label: organization.name,
      })),
    isClient,
  );
  if (
    role &&
    !supportsOrganizationPrograms &&
    (row.input.Organization || row.input.Program)
  )
    errors.push(
      "Organization and Program are only supported for Client and Promotional roles.",
    );
  return {
    errors,
    options,
    selected,
    isClient,
    supportsOrganizationPrograms,
    existingUser,
    programTokens: nonEmptyProgramTokens,
    programIds,
  };
}
