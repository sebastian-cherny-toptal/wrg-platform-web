# 02 — Close unsorted verbatim access after a sorting purchase

**Category:** bug
**State:** fixed

## Agent Brief

**Current behavior:** The client hides the ordinary workbook button once sorted verbatims are owned, but the API still accepts a workbook request without a sorting filter. Elle's concern is that comparing full and suppressed reports could reveal withheld comments.

**Desired behavior:** Once a sorting purchase applies to an organization and program, no page or direct endpoint returns an unsorted raw comment set that circumvents issue 01. The purchased, confidentiality-safe sorted report stays accessible.

**Key interfaces:** Report entitlements, the selected sorting filter, open-response answer retrieval, and the workbook endpoint must enforce the same server-side access rule. A client-only restriction is insufficient.

**Acceptance criteria:**

- [x] Before a sorting purchase, the ordinary report remains available to an entitled user.
- [x] After purchase, an ordinary workbook request and any equivalent raw-answer request cannot reveal the unsorted set.
- [x] The purchased sorted report remains accessible and obeys issue 01's suppression rule.
- [x] A direct-request regression test proves the restriction cannot be bypassed through the existing route.

**Out of scope:** Revoking files downloaded before purchase and changing report pricing.

**Dependency:** Complete issue 01 first so this issue can verify the final disclosure boundary.

**Triage/verification:** Construct an organization/program fixture with an ordinary entitlement, then add a purchased sorting entitlement. Exercise both route variants before theorizing about the defect. Record one red-capable command and redacted output.

## Reproduction and verification

The existing API already applied a saved `SEV_Filter` to direct workbook requests that omitted `queryFilter`, and to direct answer requests. The remaining gap was an enrollment with `SEV_Access: yes` but no saved `SEV_Filter`: both routes returned the unsorted comments. The page hid the ordinary download when its catalog entry was owned, but a missing catalog selection left the report in a confusing state.

From `wrg-platform-api`, before the fix:

```sh
./node_modules/.bin/tsx --test test/unit/verbatim-access.spec.ts
```

Redacted output: `not ok 1 - keeps ordinary access before purchase, applies the purchased filter, and closes access if its selection is missing`; the assertion expected HTTP 400 for the workbook route after removing the purchased selection, but received HTTP 200. The fixture contains four suppressed and five eligible completed respondents with distinctive synthetic comments. It sends authenticated requests to the existing workbook and answer routes.

After the fix, the same command passes (`1 pass, 0 fail`). The API rejects both real-report routes when the sorted entitlement has no saved selection. With a valid selection, an omitted-filter workbook request and a direct answer request retain the five-person group's comments and omit the four-person group's label and comments. Before purchase, ordinary workbook and answers remain available. The page displays a filter-unavailable state and offers neither download when ownership is known but the selection is missing.
