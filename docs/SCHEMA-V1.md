# Registry schema v1.0 — the versioned change v0 promised

**Status: schema published; the public demonstration cohort stays on v0.**
No program data appears in this repository. v1 exists so the production
shape is a reviewed, versioned artifact — not a rewrite done under contract.

v0 (`schemas/registry.schema.json`) is the demonstration schema. It
hard-requires `sample: true` at cohort and record level and fixes the TMK
division digit at 9, which no county issues — so real award data *cannot*
validate against it. That guard was documented from the first commit as a
deliberate, versioned schema change waiting to happen. This is that change.

## What v1.0 changes

| v0 | v1.0 (`schemas/registry.v1.schema.json`) | Why |
|---|---|---|
| `sample: true` const, cohort + record | `sample` optional boolean | Real data may enter; demonstration data is still marked |
| TMK division fixed at `9` | Divisions `1–4` (Oʻahu, Maui County, Hawaiʻi, Kauaʻi) | Real parcels |
| 18 required record fields | 8 required at draft (`id`, `slug`, `project`, `agency`, `status`, `publicationStatus`, `award`, `provenance`) | **Minimal at draft, complete at publication.** An enacted appropriation line knows only a program and an amount |
| `programArea` enum of 7 | Open slug | The taxonomy is a product of the outcomes framework, approved by the State, kept in the indicator dictionary |
| — | `departmentCode`, `programId` | Budget join keys (LNR407, BED170/KB) |
| `award { fiscalYear, amountUsd }` | + `meansOfFinancing`, `nonRecurring`, `legislativeReference` | The appropriation as written |
| — | `funding { status, releasedUsd, expendedUsd, asOf }` | Funding-release status — the financial transparency layer |
| — | `contact { name, email }` | Submitter accountability. Required from `validated` onward. **Never exported, never rendered** — the build strips it |
| — | `outcomes[].indicatorId` | Key into the indicator dictionary |
| — | cohort `schemaVersion`, `source`, `fiscalPublic` | Version switch; cohort provenance; "appropriation figures are public law" flag |
| `status`: active/completed/withdrawn | + `planned` | Appropriated, not yet under way |

## The release bar (validator invariants, v1)

A record may sit in the registry as a bare appropriation line. It may not
*publish* until it carries `island`, `programArea`, `act96Alignment`,
`summary`, `location`, a `story`, at least one outcome, provenance, and a
`contact` (contact is required from `validated` onward). Funding figures
cannot exceed the appropriation (`expended ≤ released ≤ amountUsd`).

The gate itself is unchanged: `draft → validated → published`, monotonic,
human-held. Only `published` records build pages or export.

## Fiscal facts are public law

A cohort marked `fiscalPublic: true` renders appropriation and
funding-status figures for **every** record in the fiscal visual (index
section and `fiscal/embed.html`), because enacted budget figures are public
before any project has a story. Project pages, stories, outcomes, and
contacts remain behind the publication gate regardless.

## How a cohort picks its schema

The validator, the build, and intake choose by the cohort file:
no `schemaVersion` → v0; `"schemaVersion": "1.0"` → v1.0. Intake creates a
v1 cohort with `--v1` (plus `--sample` and/or `--fiscal-public` as
appropriate); an existing cohort's own version always wins.

## Running the gates against a registry outside this repo

Every script accepts `--registry <dir>` or `KULEANA_REGISTRY_DIR`. The rules
do not change with the directory — only where they look. This is how a
private working cohort, a CI fixture (`schemas/fixtures/v1/`), or a
State-owned copy runs the identical gate.

```bash
node scripts/intake.mjs worksheet.xlsx --v1 --fiscal-public --write --registry ../private-registry
node scripts/validate.mjs --registry ../private-registry
node scripts/build.mjs --registry ../private-registry     # dist/ renders from it
```
