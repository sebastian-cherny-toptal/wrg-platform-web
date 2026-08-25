import type { OrganizationRecord } from "./api";

export function filterAndSortOrganizations(
  organizations: OrganizationRecord[],
  searchText: string,
): OrganizationRecord[] {
  const query = searchText.trim().toLocaleLowerCase();
  return organizations
    .filter((organization) =>
      query ? organization.name.toLocaleLowerCase().includes(query) : true,
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
}
