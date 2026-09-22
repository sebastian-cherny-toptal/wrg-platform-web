# 01 — Suppress small groups in sorted Employee Verbatims

**Category:** bug
**State:** fixed

## Agent Brief

**Before the fix:** A demographic sorting purchase could reveal comments for groups with fewer than five respondents. The API checked the organization's total respondent count, while sorted answers and workbook rows were assembled per respondent. The reproduction below confirmed this disclosure.

**Desired behavior:** When a sorting demographic is active, no comments, group names, or group-linked values from a cohort with fewer than five completed respondents are returned through the page, download, or direct API access. Groups of exactly five remain available. Apply the same rule consistently to every open-response question in the report.

**Key interfaces:** The purchased sorting-filter selection, open-response answer response, and Employee Verbatims XLSX generator must share the same confidentiality decision. The response shape may need a safe suppressed-state indicator instead of returning raw rows.

**Acceptance criteria:**

- [x] A fixture with groups of four and five completed respondents yields no identifiable data for the four-person group in API JSON, page output, or XLSX.
- [x] The five-person group's eligible comments remain available.
- [x] Direct requests cannot bypass the group threshold by choosing another question or filter parameter.
- [x] A symptom-specific red-capable reproduction is recorded before the fix and passes after it.

**Out of scope:** General report redesign and changing the five-respondent threshold.

**Triage/verification:** Start with a small API fixture for the purchased filter and assert that the four-person group's distinctive synthetic comment and category never occur in the response or workbook. Record the exact command and redacted output here before diagnosing.

## Reproduction and verification

From `wrg-platform-api`, before the fix:

```sh
./node_modules/.bin/tsx --test --test-name-pattern 'suppresses small sorted verbatim groups' test/unit/compatibility-reports.spec.ts
```

Redacted output: `not ok 1 - suppresses small sorted verbatim groups in answers and workbook`; the API JSON contained the four-person group's synthetic `private answer` and `Private Team` label. The fixture uses nine completed respondents, two open-response questions, and the purchased Department filter. It asserts the API and workbook omit the four-person cohort and retain all five eligible responses. It also checks that a direct request for the demographic question, an extra answer filter, and a different workbook filter cannot expose that cohort. A workbook request without a filter uses the purchased filter.

After the fix, the same command passes (`1 pass, 0 fail`). The full `test/unit/compatibility-reports.spec.ts` file passes (`14 pass, 0 fail`). The page renders the filtered `respondentData` from this API response, so the suppressed rows and labels are absent from its output. The existing page test passes with `npm run test --workspace @wrg/platform-client-web -- employee-verbatims.test.tsx` (`4 pass, 0 fail`).
