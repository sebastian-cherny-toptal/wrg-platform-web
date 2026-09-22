# 09 — Import historical survey definitions for the 2022 program

**Category:** bug
**State:** needs-info

## Agent Brief

**Current behavior:** The Fort Worth 2022 import review in Elle's screenshot reports unavailable question text for several EFS question keys. The platform now accepts a program-specific Questions and Answers XLSX, but the specific source files have not been tested against it.

**Desired behavior:** The historical EA/EFS files import with the intended 2022 questions and answer meanings, whether by recognized source metadata or a program-specific definition file. Review screens clearly identify missing definitions before commit, and resulting reports use that program's labels without changing another year's survey.

**Key interfaces:** Historical import prepare/commit, optional survey-definition workbook, program-scoped question metadata, and report label lookup. Keep original raw response values intact.

**Acceptance criteria:**

- [ ] The supplied 2022 source files first reproduce the missing-label state with a deterministic import-preview command.
- [ ] A documented input path supplies every required question/answer definition and completes preview and commit.
- [ ] Resulting report labels and answer scoring match an approved 2022 source, while a newer program stays unchanged.
- [x] Import preview errors identify unresolved Likert keys without silently inventing labels. A synthetic 2022 EFS regression covers this path.

**Out of scope:** A platform-wide survey schema redesign or retroactively changing other program definitions.

**What is needed:** The Fort Worth 2022 EA/EFS workbooks and approved 2022 question/answer definitions, redacted if necessary. The screenshot and filenames alone cannot validate the import.

## Verification and remaining work

The API now uses the same question-template lookup in EFS preview and commit,
limited to the selected program year or the same program. The admin review shows
blocking preview issues and retains each workbook's result when navigating back
through the wizard. A synthetic 2022 EFS test confirms that a key with only a
2026 template is flagged and that an exact-key definition resolves it. This does
not establish the correct Fort Worth 2022 wording or answer meanings. No Fort
Worth 2022 workbook or approved definition was found in the workspace.

With the approved files available, run the read-only preview against a local API
and compare `validation.issues` and `blockingErrorCount` before and after adding
the definition workbook. Set `API_URL`, `ACCESS_TOKEN`, `EFS_2022`, and
`DEFINITION_2022` to the local API URL, admin token, and file paths. The EA file
can be previewed separately by replacing `efsFile` with `eaFile`.

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'metadata={"projectName":"Fort Worth","programName":"Fort Worth 2022","programYear":2022,"efsLaunchDate":"2022-01-01","efsDeadline":"2022-12-31"}' \
  -F "efsFile=@$EFS_2022" \
  "$API_URL/admin/historicalImports/prepare" \
  | jq '.data.validation | {blockingErrorCount, issues}'

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'metadata={"projectName":"Fort Worth","programName":"Fort Worth 2022","programYear":2022,"efsLaunchDate":"2022-01-01","efsDeadline":"2022-12-31"}' \
  -F "efsFile=@$EFS_2022" \
  -F "surveyDefinitionFile=@$DEFINITION_2022" \
  "$API_URL/admin/historicalImports/prepare" \
  | jq '.data.validation | {blockingErrorCount, issues}'
```

The dates in this preview example are placeholders; use the actual program dates
for commit. Once the sources are supplied, compare each imported question caption,
answer caption, and score with the approved 2022 definition, verify the resulting
report, verify a newer program's definitions remain unchanged, and then commit.
