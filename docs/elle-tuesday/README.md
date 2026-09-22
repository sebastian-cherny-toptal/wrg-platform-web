# Elle's September 2026 feedback: review backlog

This is a local Markdown backlog for the unresolved requests in Elle's September 14 feedback, quoted in `Work from Tuesday.eml`. The September 15 reply only confirms a recurring meeting-time change. [Source notes](source-notes.md) describe the email and screenshots without copying private material into Git.

The issues below cover every item previously assessed as open, partial, or unverified. They are ordered for **one issue at a time** review. A blocked `needs-info` issue may be skipped and revisited when its evidence arrives. A brief's category is either `bug` or `enhancement`; its state records current local progress. These are local document states, not GitHub labels.

| Order | Issue | Category | Current state |
| --- | --- | --- | --- |
| 01 | [Sorted verbatim confidentiality](issues/01-sorted-verbatim-confidentiality.md) | bug | fixed |
| 02 | [Unsorted verbatim access after purchase](issues/02-unsorted-verbatim-access.md) | bug | needs-triage |
| 03 | [Benchmark cohort minimum](issues/03-benchmark-cohort-minimum.md) | bug | fixed locally |
| 04 | [Promotional data access](issues/04-promotional-data-access.md) | bug | needs-triage |
| 05 | [Detailed Results confidentiality copy](issues/05-detailed-results-confidentiality-copy.md) | bug | ready-for-agent |
| 06 | [Detailed Results percentages](issues/06-detailed-results-percentages.md) | bug | needs-triage |
| 07 | [Workforce Benchmark Comparisons reconciliation](issues/07-workforce-benchmark-reconciliation.md) | bug | needs-info |
| 08 | [Benefits & Best Practices rendering](issues/08-benefits-best-practices-rendering.md) | bug | partially fixed locally; real-data verification needs-info |
| 09 | [Historical survey import](issues/09-historical-survey-import.md) | bug | needs-info |
| 10 | [Employee Verbatims workbook layout](issues/10-employee-verbatims-workbook-layout.md) | bug | fixed locally |
| 11 | [Key Impact Analysis upload status](issues/11-key-impact-upload-status.md) | bug | fixed |
| 12 | [Key Impact Analysis layout](issues/12-key-impact-analysis-layout.md) | enhancement | ready-for-agent |
| 13 | [Response Detail custom demographics](issues/13-response-detail-custom-demographics.md) | bug | needs-info |
| 14 | [Store button colors](issues/14-store-button-colors.md) | enhancement | ready-for-agent |
| 15 | [User-management program column](issues/15-user-program-column.md) | enhancement | ready-for-agent |
| 16 | [Individual-organization re-sort edits](issues/16-organization-resort-edits.md) | enhancement | needs-info |

## Review protocol

1. Review this documentation change before implementing issue 01. Keep subsequent changes scoped to one issue. If it spans the web and API repositories, use one conceptual issue with linked, separately reviewable changes in each repository.
2. For a bug, follow `diagnosing-bugs`: record one fast, deterministic, red-capable command and its **redacted** output before proposing causes. Reproduce and minimize the exact symptom, rank three to five falsifiable hypotheses, add a regression test at the correct seam, fix, then rerun both the test and original reproduction. If a loop cannot be built without missing data, move the issue to `needs-info` and record what is needed.
3. For an enhancement, confirm current behavior and acceptance checks before changing code. Run focused tests and the relevant repository checks. Remove temporary instrumentation.
4. Present the issue diff and test evidence for code review. Do not start the next issue until the current issue has been reviewed. Do not merge or deploy as part of this backlog creation.

## Already implemented; no new issue

- The **Race/Ethnicity** label is supported in report and import code.
- Programs with no benchmark categories use a default cohort.
- ACH payment handling exists in both applications.
- The four main store reports have **Downloadable!** badges.
- Admin bulk user creation accepts CSV/XLSX.
- Admins can add program years to existing users.

These are code findings, not proof of deployment or real-data correctness. If later verification finds a defect, triage it as a new, specific issue.
