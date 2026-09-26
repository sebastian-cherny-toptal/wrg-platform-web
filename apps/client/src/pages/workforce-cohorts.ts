export type WorkforceCohortHeader = {
  title: string;
  type: string;
  color: string;
  employeeSize?: string | undefined;
};

export type WorkforceCohort = {
  label: string;
  key: string;
  index: number;
  kind: "winner" | "nonWinner";
};

const cohortOrder = ["all", "boutique", "small", "smallmedium", "medium", "large", "mega", "major"];
const emptyHeader: WorkforceCohortHeader = { title: "", type: "", color: "" };

function normalizedSize(header: Pick<WorkforceCohortHeader, "title" | "type">) {
  const normalize = (value: string) => value
    .toLowerCase()
    .replace(/non[\s_-]*winners?|winners?|employers?|yes|no/g, "")
    .replace(/[^a-z]/g, "");
  const normalizedType = normalize(header.type);
  const normalizedTitle = normalize(header.title);
  const normalized = normalizedType || normalizedTitle;

  // Zoho historically calls the Small-Medium cohort "Super" in its data key.
  return normalized.includes("smallmedium") || normalized.includes("super")
    ? "smallmedium"
    : cohortOrder.find((size) => normalized === size) ??
      cohortOrder.find((size) => normalizedTitle.startsWith(size)) ??
      normalized;
}

function cohortRank(header: Pick<WorkforceCohortHeader, "title" | "type">) {
  const rank = cohortOrder.indexOf(normalizedSize(header));
  return rank === -1 ? cohortOrder.length : rank;
}

export function sortWorkforceHeaders<T extends WorkforceCohortHeader>(headers: T[]): T[] {
  return headers
    .map((header, index) => ({ header, index }))
    .sort((left, right) => cohortRank(left.header) - cohortRank(right.header) || left.index - right.index)
    .map(({ header }) => header);
}

export function workforceCohorts(headers: WorkforceCohortHeader[]): WorkforceCohort[] {
  return headers
    .map((header, index) => {
      const key = header.type.replace(/[_\s-]/g, "");
      const kind = /no$/i.test(key) ? "nonWinner" : /yes$/i.test(key) ? "winner" : null;
      const label = header.employeeSize
        ? `${header.title} (${header.employeeSize} Employees)`
        : header.title;
      return kind ? { label, key, index, kind } : null;
    })
    .filter((cohort): cohort is WorkforceCohort => cohort !== null)
    .sort((left, right) => {
      const leftHeader = headers[left.index] ?? emptyHeader;
      const rightHeader = headers[right.index] ?? emptyHeader;
      return cohortRank(leftHeader) - cohortRank(rightHeader) || left.index - right.index;
    });
}

export function pairedWorkforceCohorts(headers: WorkforceCohortHeader[]) {
  const cohorts = workforceCohorts(headers);
  return cohorts
    .filter((cohort) => cohort.kind === "winner")
    .map((winner) => {
      const winnerHeader = headers[winner.index] ?? emptyHeader;
      const size = normalizedSize(winnerHeader);
      const nonWinner = cohorts.find(
        (cohort) =>
          cohort.kind === "nonWinner" &&
          normalizedSize(headers[cohort.index] ?? emptyHeader) === size,
      );
      return { label: winner.label, winnerIndex: winner.index, nonWinnerIndex: nonWinner?.index };
    });
}
