# 10 — Remove blank areas from the ordinary verbatim workbook

**Category:** bug
**State:** fixed locally

## Agent Brief

**Original behavior:** Elle's spreadsheet screenshot shows unnecessary blank areas after ordinary Employee Verbatims comments. A generated workbook with two synthetic responses still saved styled rows through row 140 and conditional formatting over `A5:B140`, even though the demographic column had been removed.

**Desired behavior:** The ordinary download ends at the last populated response and has no empty demographic column or styled response region. A purchased sorted download retains its useful demographic column and rows.

**Key interfaces:** Employee Verbatims XLSX template expansion and workbook cleanup, for ordinary and sorted variants.

**Acceptance criteria:**

- [x] A generated ordinary workbook with fewer responses than template rows reproduces the blank area.
- [x] The final used range and conditional formatting end at the last response row and column.
- [x] Sorted workbook demographic labels and response rows remain intact, including rows beyond the template.
- [x] Workbook structure regression checks cover both the styled tail and conditional formatting range.

**Out of scope:** Changing verbatim content, ordering, or confidentiality; issues 01–02 own those rules.

**Triage/verification:** The red-capable command is `./node_modules/.bin/tsx --test --test-name-pattern 'employee verbatim workbook generation' test/unit/report-template-workbooks.spec.ts` in `wrg-platform-api`. Before the fix, the two-response ordinary and sorted cases failed with `140 !== 6`; an expanded sorted case failed because its formatting stopped at `A5:B86` instead of `A5:B87`. The generated XLSX XML confirmed styled rows through row 140 for the ordinary sheet and conditional formatting over `A5:B140`.

**Cause and fix:** ExcelJS's single bulk `spliceRows` left styled template rows behind at the end of a sheet. Row removal now proceeds from the bottom, and the template's conditional-format range is set to the actual response rectangle (or removed for an empty sheet). The ordinary workbook keeps only column A; sorted workbooks keep column B and its labels.

**Post-fix evidence:** The same command passes (3 tests). A saved two-response XLSX has final row 6, final cell `A6`, and conditional formatting `A5:A6`; its empty second sheet ends at row 4 with no response formatting. The full `report-template-workbooks.spec.ts` suite passes (8 tests), the compatibility report suite passes (17 tests), and ESLint and API typecheck pass. The private screenshot itself is unavailable for a pixel comparison; the recorded workbook structure reproduces and resolves its reported blank-area symptom.
