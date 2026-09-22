# 05 — Use Elle's Detailed Results confidentiality message

**Category:** bug
**State:** fixed

## Agent Brief

**Current behavior:** Confidential Detailed Results responses use an older message about confidentiality reasons and responses being less than five.

**Desired behavior:** Every confidentiality response shown on Detailed Results uses this exact text: “The information is not visible to maintain confidentiality. The number of employee responses is fewer than 5.”

**Key interfaces:** The report API's confidential-result message and the client state that displays it. Preserve the existing `isConfidential` signal and access rule.

**Acceptance criteria:**

- [x] The confidential Detailed Results page displays the exact sentence, including punctuation.
- [x] Relevant API responses contain the same sentence, so direct consumers agree with the page.
- [x] Non-confidential results are unchanged.

**Out of scope:** Changing which cohorts are confidential or updating copy on unrelated reports.

**Verification:** Use a confidential report fixture to assert exact API and rendered text before changing the implementation; the assertion should fail on the current wording.
