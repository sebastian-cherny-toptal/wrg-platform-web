# 04 — Prevent real report delivery to promotional users

**Category:** bug
**State:** fixed in local web and API working trees; deployment verification pending

## Agent Brief

**Current behavior:** The promotional home page blurs chart elements, omits report cards, and opens a store dialog, but it still requests dashboard data. Elle observed little difference between the promotional and old client experience.

**Desired behavior:** Promotional users see a clear store/demo entry point and no real organization dashboard or report data. Demos use sample data. Direct API requests with a promotional session must uphold the same boundary.

**Key interfaces:** Promotional role checks, dashboard/report authorization, demo-data selection, and the home-page modal. The web and API changes should be reviewed as one issue with linked repository changes if both are needed.

**Acceptance criteria:**

- [x] A promotional session's home page opens the store/demo invitation and shows no real report values.
- [x] Its dashboard and report network/API responses contain no real organization results, including after dismissing the dialog.
- [x] Demo navigation still returns clearly labeled sample data.
- [x] A normal entitled client retains access to its real dashboard and reports.
- [x] A red-capable promotional-session request test is recorded before the fix.

**Out of scope:** Store pricing, the promotional account creation flow, and changes to normal client report entitlements.

**Triage/verification:** Exercise a promotional role fixture through the home-page request and a direct dashboard API request; inspect redacted response payloads for a sentinel real-data value.

## Verification in working trees

The direct-request test in `wrg-platform-api/test/unit/promotional-data-access.spec.ts` was run before the fix and failed: a promotional token received HTTP 200 from `surveyResponseRate` with the real-data sentinel `98765`. After the fix it verifies HTTP 403 for live dashboard/report requests, sample responses without the sentinel, a sample workbook without the real organization name, and live access for a normal client. The web test in `apps/client/src/pages/promotional-dashboard.test.tsx` verifies the promotional home page requests sample data and remains labeled after the invitation closes.

API unit tests passed on a clean rerun (138 tests), and API typecheck and build passed. Web client tests passed (37 tests), and the client build passed. The first API suite run alongside both builds had one intermittent failure; the immediate full rerun passed. A deployed promotional login and network trace remain to be checked after both repositories are released together.
