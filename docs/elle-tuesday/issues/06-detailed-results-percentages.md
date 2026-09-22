# 06 — Correct impossible Detailed Results percentages

**Category:** bug
**State:** fixed

## Agent Brief

**Current behavior:** Elle's screenshot shows disagreement at 148% for two responses in a question where other displayed groups are 96% and 3%. The underlying counts appear plausible, but the displayed percentages are not.

**Desired behavior:** Question-level Agreement, Neutral, and Disagreement figures use one valid denominator and match their response counts. Each displayed percentage is between 0% and 100%; the groups total approximately 100%, allowing only normal rounding differences.

**Key interfaces:** Detailed-result API distribution values and the client grouping/presentation of answer buckets. Keep count and percentage units explicit across the boundary.

**Acceptance criteria:**

- [x] A minimized fixture representing two disagreement responses reproduces the incorrect displayed figure before the fix.
- [x] The corrected figure agrees with the response count and denominator in both text and bar segments.
- [x] Existing five-point and custom-answer question cases remain coherent, including N/A handling.
- [x] A regression test covers the API response-to-display seam, not only a standalone formatter.

**Out of scope:** Broad visual redesign and altering recorded survey answers.

**Triage/verification:** Build and run a deterministic question-distribution test that asserts the exact 148% symptom first. Record its command and redacted output; only then rank causes and instrument the boundary.

## Verification

The client regression fixture contains 192 agreement, 6 neutral, and 2 disagreement responses. Two disagreement answer rows each carry an erroneous `percent: 74`; before the fix the page rendered `Disagreement: 148% (2 responses)`. The focused test failed with `expected document not to contain element, found <span>Disagreement: 148% (2 responses)</span>`.

The client now derives question-level text and bar widths from response counts and groups configured five-point answer labels by `agreementGroup`. The API denominator now includes only answer rows it returns, excluding N/A and legacy unmapped codes. A configured-answer fixture verifies N/A exclusion.

- API: `node --import tsx --test --test-name-pattern='uses displayed Likert counts' test/unit/compatibility-reports.spec.ts`
- Client: `npm run test --workspace @wrg/platform-client-web -- --run src/pages/detailed-results.test.tsx`
