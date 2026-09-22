# 15 — Show assigned program names and years in the users table

**Category:** enhancement
**State:** implemented

## Agent Brief

**Current behavior:** Admins can edit a user's assigned programs, but the users-management table shows projects and organizations without a dedicated program/year column. This makes users with multiple annual dashboards hard to identify.

**Desired behavior:** A visible users-table column lists each assigned program's name and year. Multiple assignments are readable and an unassigned user shows an explicit empty value. The existing column chooser can show or hide this field.

**Key interfaces:** The users-list response must provide displayable program identities, and the admin table/column chooser must consume them. Avoid extra per-row requests. Preserve existing edit behavior.

**Acceptance criteria:**

- [x] A user with multiple assigned programs displays every program with its correct year.
- [x] A user without programs displays an empty-state marker.
- [x] The column is available through the table's visibility controls and remains aligned in export if the table exports visible columns. (The users table has no export.)
- [x] Program assignment changes appear after the existing list refresh.

**Out of scope:** Adding new program assignments, changing annual-trends logic, or introducing a new table sort unless needed by existing table conventions.

**Verification:** Add API/list and admin-table tests for zero, one, and multiple program assignments.
