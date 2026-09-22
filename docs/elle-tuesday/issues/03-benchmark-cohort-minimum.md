# 03 — Hide benchmark cohorts with fewer than five organizations

**Category:** bug
**State:** fixed locally

## Agent Brief

**Original behavior:** Elle reported non-winner calculations for cohorts smaller than five. A deterministic report fixture reproduced the same leak with four winners: the API returned `100` where the cohort should have been suppressed.

**Desired behavior:** For each winner/non-winner pair, including the overall cohort and each size category, show a value only when the applicable cohort contains at least five included organizations. Suppressed values remain suppressed in the on-screen tables, summary cards, and workbook.

**Key interfaces:** Benchmark group construction and report serialization should supply one eligibility decision to table rows, survey averages, and workbook output. Only program enrollments marked included count toward the five.

**Acceptance criteria:**

- [x] Cohort sizes zero through four produce no numeric figure anywhere in the report or download.
- [x] Size five produces figures when data exists.
- [x] Winner and non-winner cohorts are evaluated independently for every size category and overall.
- [x] Excluded organizations do not increase the eligible count.
- [x] A red-capable report test with four/five organizations is recorded and passes after the fix.

**Out of scope:** Changing the category assigned by Zoho or the survey percentage formula; issue 07 handles figure reconciliation.

## Diagnosis and verification

The focused API command is `node --import tsx --test --test-name-pattern 'suppresses benchmark cohorts below five' test/unit/compatibility-reports.spec.ts`. Before the fix, it failed with `Expected values to be strictly equal: 100 !== 'x'` at the Small winner category assertion. It now passes. The fixture has four included Small winners, one included Medium winner, five included Small non-winners, and one excluded Small winner. It checks detail, category and survey averages, the XLSX cells, direct comparison endpoints, and both overall winner/non-winner boundaries from zero through five. It also checks a stored comparison snapshot.

The group eligibility rule hid only empty groups; changing it to fewer than five fixes the API and workbook paths that consume that decision. The program enrollment query already filters `isIncluded: true`. The client summary card separately parsed suppressed `"x"` as zero; it now keeps the suppression marker, while showing a genuine zero as `0%`. The comparison detail API and client schema now carry `"x"` rather than manufacturing a numeric zero.

Alternative causes checked: an inclusion query that counted excluded enrollments (the query filters them), workbook token substitution that changed `"x"` to a number (the workbook preserves it), and client formatting that changed `"x"` to zero (confirmed in the Comparison Data summary card).

Verification: API unit suite, API lint and typecheck, client suite with two workers, client lint and typecheck pass. The default parallel client suite hit unrelated five-second test timeouts while the API suite was running; the two-worker rerun passed all 35 tests. Real-data figure reconciliation remains in issue 07.
