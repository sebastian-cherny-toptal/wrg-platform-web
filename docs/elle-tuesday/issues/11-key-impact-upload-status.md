# 11 — Refresh Key Impact Analysis upload status without a hard reload

**Category:** bug
**State:** fixed

## Agent Brief

**Current behavior:** Elle uploaded a purchased Key Impact Analysis report successfully, but the sidebar still said it was awaiting upload. The sidebar derives that label from the selected program's delivered status. Her report also looked unusual; layout is handled separately by issue 12.

**Desired behavior:** After a successful admin upload, the corresponding client's sidebar and report view reflect delivery on the next in-app data refresh/navigation, without a browser hard reload. Other pending purchases remain labeled pending.

**Key interfaces:** KIA upload completion, selected-program report-selection state, client session/query invalidation or refresh, and sidebar status presentation.

**Acceptance criteria:**

- [x] A purchased pending report initially displays the pending sidebar label.
- [x] After a simulated successful upload and normal client refresh/navigation, the label disappears and the report is available without a hard reload.
- [x] A failed upload or different program does not change the pending label.
- [x] A red-capable flow test captures the stale-label symptom before the fix.

**Out of scope:** KIA visualization design and replacing the upload format.

**Triage/verification:** Build an upload-then-client-navigation test or a redacted request replay that distinguishes stale client state from an API status that never becomes delivered. Record the command before hypothesizing.

**Resolution:** The upload already persisted rows and `KIA_Order_Status: Delivered` in one transaction. The client login response omitted that status, and the browser kept the login-time session through navigation. The API now exposes the current status for the authenticated client's programs. The client refreshes it on navigation, updates its session, and invalidates a cached KIA report when delivery changes.

**Verification:** `npx vitest run src/app/shell.test.tsx` initially failed because no status request was made; `npx tsx --test test/unit/client-login.spec.ts` initially failed because login omitted `Delivered`. Both pass after the fix. The client flow covers pending to delivered, cached report reload, and a second pending program. The API upload test confirms an invalid workbook leaves the status pending.
