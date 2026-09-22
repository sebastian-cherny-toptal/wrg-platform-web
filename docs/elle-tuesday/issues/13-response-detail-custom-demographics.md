# 13 — Decide which custom demographics belong in Response Detail

**Category:** bug
**State:** needs-info

## Agent Brief

**Current behavior:** Elle saw organization-specific demographic columns in an Ace Electric Response Detail example. Her email does not say whether the columns are wrong because they are custom, mislabeled, incorrectly scoped, or should be hidden for another reason. Sebastian requested clarification and no answer appears in the thread.

**Desired behavior:** The report includes precisely the demographic questions intended for this organization's program, with correct labels and confidentiality handling. The expected inclusion rule must be confirmed before implementation.

**Key interfaces:** Program survey definitions, demographic question selection, and Response Detail column generation.

**Acceptance criteria:**

- [ ] An approved expected-column list for the example is recorded, including the reason for including or excluding each disputed field.
- [ ] A redacted fixture reproduces any confirmed difference between expected and actual output.
- [ ] The corrected report and download contain the approved fields and do not change unrelated programs.

**Out of scope:** Hiding every custom field or changing raw responses without a confirmed product rule.

**What is needed:** Elle's expected column list for the Ace Electric example and a redacted source/report sample. Until supplied, this remains `needs-info` rather than a speculative filtering change.

## September 22 implementation check

The original concern is **not yet confirmed as fixed** for Ace Electric. The source email has no approved inclusion list or redacted Ace Electric workbook, so the disputed columns cannot be judged against an expected report.

A separate, reproducible workbook defect was found: the API's Response Detail template contained example organization fields (`FSLA STATUS` and `A B`) and other fixed demographic options. The browser filter list was already derived from the selected program, so it could offer a custom field that a filtered workbook could not find in the template. The API now builds workbook columns from the selected program's actual demographic responses, removes the template's example columns, uses the same demographic labels for filters and exports, supports custom fields in full and filtered exports, and applies the five-response minimum to workbook access. Synthetic workbook tests cover the program-specific columns and custom filtered export. The client now displays a workbook download error instead of silently leaving the user with no file.

**Still missing:** Elle's approved Ace Electric column list with a reason for each disputed field, a redacted Ace Electric source/report pair, and a comparison of the corrected on-screen report and workbook against that approval. These are required before marking the issue complete or changing the inclusion rule.
