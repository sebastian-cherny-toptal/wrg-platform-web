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
