# 07 — Reconcile Workforce Benchmark Comparisons figures

**Category:** bug
**State:** partially fixed locally; real-data reconciliation needs-info

## Agent Brief

**Current behavior:** Elle found small differences in an annotated Inland Northwest 2026 workbook and named three possible factors: organizations marked not included, N/A response codes, and benefit-question mapping. Included-organization filtering exists in the report path, but the exact mismatched cells are not available locally.

**Desired behavior:** For the supplied program and survey data, every highlighted figure agrees with the approved reference calculation or has a documented reason for an intentional difference. N/A values, including raw codes 6 and 99, do not count as positive answers or valid denominator responses.

**Key interfaces:** Program inclusion status, benchmark agreement aggregation, question/answer mapping, and generated workbook figures. Reuse the cohort threshold from issue 03.

**Acceptance criteria:**

- [ ] A cell-by-cell comparison records source values, expected values, actual values, and the approved calculation rule.
- [x] Excluded organizations and N/A responses are covered by deterministic regression cases.
- [ ] The annotated discrepancies are resolved or explicitly documented as expected differences.

**Out of scope:** Changing winner/category assignments or guessing corrections from screenshots alone.

**What is needed:** Elle's annotated Inland Northwest workbook and the matching source EA/EFS or a redacted, reproducible export. The email references the annotated workbook but does not contain it. Once received, build a red-capable cell comparison before proposing causes.

## Local verification, September 22, 2026

The existing cohort regression for issue 03 proves that an excluded organization does not increase the five-organization threshold. A new API fixture exercises five included winners, one excluded winner, legacy numeric answers, and survey-definition answer mapping. Before the fix, the benchmark API counted raw `6`, `99`, and an unmapped `7` as valid denominator responses; numeric answers above five also counted as positive. The focused test failed with `71.42857142857143` where the expected category figure was `50`. The workbook is populated from those API figures. The aggregation now accepts numeric Likert answers only in the `1`–`5` range and excludes N/A captions and unmapped answers.

The following cell comparison uses **synthetic test data**, not Elle's annotated Inland Northwest workbook. The source values and expected rule are explicit so the fixture can be replayed. The excluded winner has a positive answer on each question and must have no effect.

| Workbook cell | Source answers in five included winners | Expected | Before fix, API | After fix, workbook | Calculation rule |
| --- | --- | ---: | ---: | ---: | --- |
| `B9`, legacy question, All Winners | `1, 5, 6, 99, 7` | 50% | 80% | 50% | One positive (`5`) out of two valid (`1, 5`); `6`, `99`, and unmapped `7` excluded. |
| `B10`, mapped question, All Winners | `10→5, 20→1, 6→N/A, 99→N/A, 7→unmapped` | 50% | 50% | 50% | One positive mapped answer out of two valid mapped answers. |
| `B18`, category average, All Winners | Both questions above | 50% | 71.42857142857143% | 50% | Two positive answers out of four valid answers across both questions. |

The API's category and question figures match those workbook cells. A second mapping check deliberately assigns positive scores to raw `6` and `99`; the mapped question previously returned `75%` and now remains `50%`, because those raw codes still mean N/A. The existing client test verifies that a suppressed `x` stays suppressed and a real zero remains `0%`; the client does not calculate the benchmark percentages. The API compatibility report suite and the focused client test pass locally.

**Still missing:** The annotated Inland Northwest workbook, its matching EA/EFS source, and the approved reference rules for each highlighted cell. Without them, the actual discrepancies and any intentional differences cannot be marked reconciled. The local fixture does not establish the deployed application's state.
