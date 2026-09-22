# 16 — Define individual-organization data edits for re-sorts

**Category:** enhancement
**State:** needs-info

## Agent Brief

**Current behavior:** The existing re-sort operation queues a survey re-sync. Elle proposed editing an individual organization's data so changed Department or Job Level ordinals/labels could be handled without rerunning everything. The email references a before/after workbook but does not include it, and does not define which responses or metadata may be edited.

**Desired behavior:** An authorized admin can apply the approved organization-level re-sort changes safely, preview the affected responses and reports, and retain an audit trail. The precise editable fields and workflow must be agreed from the sample before an implementation interface is specified.

**Key interfaces:** Organization/program survey responses, question and answer definitions, admin authorization, affected-report refresh, and audit history. No endpoint or database shape is proposed until the edit contract is known.

**Acceptance criteria:**

- [ ] The before/after example identifies editable fields, scope, and expected report changes.
- [ ] Product decisions cover preview, approval, rollback/correction, and who may edit.
- [ ] An implementation brief with concrete input/output and audit behavior is approved before code work.
- [ ] A representative organization can be updated without altering another organization's survey data.

**Out of scope:** Building a general-purpose editor for every survey response before the re-sort requirements are defined.

**What is needed:** The linked before/after workbook or a redacted equivalent, plus Elle's answers about the intended edit workflow. Keep this at `needs-info` until those decisions are captured.
