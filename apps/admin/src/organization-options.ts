import type { OrganizationRecord } from "./api";

function organizationIdentity(organization: OrganizationRecord): string {
  const sourceId = organization.sourceId.trim().toLocaleLowerCase();
  if (sourceId && sourceId !== organization.id.toLocaleLowerCase()) {
    return `source:${sourceId}`;
  }
  return `name:${organization.name.trim().toLocaleLowerCase()}`;
}

export function mergeOrganizations(
  organizations: OrganizationRecord[],
): OrganizationRecord[] {
  const merged = new Map<string, OrganizationRecord>();
  for (const organization of organizations) {
    const key = organizationIdentity(organization);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...organization,
        programs: [...organization.programs],
        users: [...organization.users],
      });
      continue;
    }
    current.programs = [
      ...new Map(
        [...current.programs, ...organization.programs].map((program) => [
          program.id,
          program,
        ]),
      ).values(),
    ];
    current.users = [
      ...new Map(
        [...current.users, ...organization.users].map((user) => [user.id, user]),
      ).values(),
    ];
  }
  return [...merged.values()];
}

export function filterAndSortOrganizations(
  organizations: OrganizationRecord[],
  searchText: string,
): OrganizationRecord[] {
  const query = searchText.trim().toLocaleLowerCase();
  return mergeOrganizations(organizations)
    .filter((organization) =>
      query ? organization.name.toLocaleLowerCase().includes(query) : true,
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
}
