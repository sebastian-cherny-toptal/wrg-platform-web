# Baton Rouge E2E fixture

`baton-rouge-test-data.zip` contains sanitized versions of the six 2024–2026
Baton Rouge survey workbooks plus six aggregate published-report workbooks.
All row-level identifiers, categorical strings, and free text are replaced with
deterministic synthetic tokens; numeric survey values are retained so report
calculations exercise the real database code paths.

Do not replace this archive with the raw survey export. Regenerate it from the
API repository with `npm run fixture:baton-rouge`.
