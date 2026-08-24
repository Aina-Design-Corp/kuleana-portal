# intake/ — drop zone for award data sources

Put a structured source file (`.xlsx` or `.csv`, column contract in
[`docs/INTAKE.md`](../docs/INTAKE.md)) here on a working branch and push.
The `intake` workflow transforms it into **draft** registry records, commits
them back to the branch, and the required `validate` check judges the PR.
Intake proposes; a human publishes.

PDF and legacy `.xls` sources walk the assisted-extraction path (same doc)
into a CSV that lands here — same contract, same gate.

`samples/` holds the committed demonstration fixtures (fictional data, both
formats); CI diffs their transforms for parity on every intake change.
