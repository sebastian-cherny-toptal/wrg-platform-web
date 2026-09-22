# 12 — Add a ranked Key Impact Analysis table

**Category:** enhancement
**State:** implemented

## Agent Brief

**Current behavior:** Key Impact Analysis presents contribution bubbles as its primary visualization. Elle described the report as visually awkward and raised a table as an alternative. The agreed direction is a table first, with an improved bubble chart retained as a secondary view.

**Desired behavior:** Show a readable, accessible table ranking contributions from highest to lowest, with the question/category label and contribution percentage. Keep the bubble visualization below or behind a clearly labeled secondary view, using the same values. Preserve purchase/demo and download behavior.

**Key interfaces:** Existing KIA report data and the client rendering of its mapping and labels. No new report API shape is required unless the existing response lacks a label needed by both views.

**Acceptance criteria:**

- [x] The ranked table is the first data presentation and uses descending contribution order with deterministic tie handling.
- [x] Each row has a readable label and percentage; keyboard and screen-reader users can inspect every row.
- [x] The secondary chart presents the same data without clipping or obscuring labels at supported widths.
- [x] Demo, pending-upload, purchased-report, and download states still work.

**Out of scope:** Recalculating contributions or changing the uploaded KIA file.

**Verification:** Add component checks for sorting, labels, accessibility, and matching chart/table values; visually inspect narrow and desktop widths.

**Implementation note:** The client now ranks the API mapping by contribution, breaking ties by question text. The table shows rank, category, question and percentage, with stacked rows on narrow screens. A collapsible bubble view uses the same sorted rows. The API upload now rejects rows missing a label or key, invalid contribution values, and duplicate keys so the mapping and labels stay aligned. Client component checks, API upload checks, and desktop/mobile browser checks cover the layout and fallback download.
