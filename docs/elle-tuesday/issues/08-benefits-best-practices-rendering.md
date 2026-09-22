# 08 — Reproduce Benefits & Best Practices rendering failure

**Category:** bug
**State:** partially fixed locally; Inland Northwest verification needs-info

## Agent Brief

**Current behavior:** Elle reported that Benefits & Best Practices did not render for Inland Northwest. The API contains an EA-derived report path, but the failing program data and response are not present locally.

**Desired behavior:** An entitled Inland Northwest user can open and download the report when valid EA data exists. Displayed and workbook figures match an approved comparison report, with clear empty/error behavior when source data is unavailable.

**Key interfaces:** Program EA import, generated Benefits & Best Practices report data, client report rendering, and XLSX download.

**Acceptance criteria:**

- [ ] A redacted Inland Northwest fixture or captured request reproduces the reported failure before a fix.
- [ ] The same Inland Northwest case renders and downloads successfully afterward, or displays the correct source-data error if data is genuinely absent.
- [ ] A numerical comparison against an approved report is recorded for representative rows and cohorts.

**Out of scope:** Reworking report design or changing benchmark confidentiality rules from issue 03.

**What is needed:** A redacted Inland Northwest program dataset or request/response capture, plus a known-good Benefits & Best Practices workbook for comparison. No root-cause hypothesis should be selected until a red-capable loop runs.

## Local verification, September 22, 2026

The existing API implementation generated Benefits & Best Practices from an Employer Assessment (EA), and the client already called its report and workbook endpoints. The client browser test only covered a mocked page display. It did not prove that an entitled program could load or download the report.

A new **synthetic** API fixture has five included winners and five included non-winners with valid EA answers and no Employee Feedback Survey (EFS). The fast reproduction command is `npm exec -- tsx --test test/unit/benefits-best-practices-from-ea.spec.ts` in `wrg-platform-api`. Before the fix, the entitled report request failed with `NotFoundException: Survey not found` in `CompatibilityReportsService.context`, before EA generation. The same test now confirms the API and downloadable workbook values for both cohorts, and that removing the EA returns the report's source-data 404.

The cause in this reproducible case was the shared report context requiring an EFS for a report that uses EA data. Benefits & Best Practices now loads program access and cohorts without requiring EFS. Other report paths still require their employee survey. The client now offers Download Report only after the Benefits response contains questions. Focused Chromium tests verify displayed percentages, a triggered XLSX download, and the 404 message with no download action.

| Synthetic row and cohort | EA answers | Expected API | Expected workbook | Verified |
| --- | --- | ---: | ---: | --- |
| Fun Activities, All Winners | Five included organizations answered `1` | 100% | 100% (`1` in the percent-formatted cell) | API `100`; workbook `1` |
| Fun Activities, All Non-Winners | One `1` and four `0` answers | 20% | 20% (`0.2` in the percent-formatted cell) | API `20`; workbook `0.2` |

**Still missing:** The Inland Northwest program EA data or a redacted failing request/response capture, deployment/build information for the affected environment, and an approved Benefits & Best Practices workbook for representative row and cohort comparison. The synthetic case proves this specific local failure and fix, but does not establish that it caused Elle's live report failure or that all Inland Northwest figures agree with the approved report.
