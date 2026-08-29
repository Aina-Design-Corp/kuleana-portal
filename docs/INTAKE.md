# Intake — how award data gets into the registry

**Status: proof-of-concept documentation — all intake sources here are
fictional samples; the v0 schema guard (`sample: true`, division-9 TMKs)
means real program data cannot enter this registry.**

Award data arrives in whatever shape a program office produces: a
spreadsheet export, a CSV, a stack of contract PDFs. Intake is the pipeline
stage that turns any of those into draft registry records — and the design
rule is that **the pipeline is source-agnostic**: every record, regardless of
where it came from, passes the same schema validation, the same invariants,
and the same human publication decision. Messier sources cost more human
minutes, never a different (weaker) gate.

```
source file (.xlsx / .csv)          PDF or legacy .xls
        │                                  │
        │                        assisted extraction
        │                        (human + tooling)
        │                                  │
        └────────────► column contract ◄───┘
                            │
                 scripts/intake.mjs        gate 0 — transform
                            │
                draft registry records     publicationStatus: "draft"
                            │
                 scripts/validate.mjs      gate 1 — schema + invariants
                            │
                     reviewed PR merge     gate 2 — a human accepts the records
                            │
              publicationStatus flip       gate 3 — a human publishes, in its
                 in a later reviewed PR             own diff, never automated
```

## The functional flow

1. **Drop the source file** into `intake/` on a working branch
   (`intake/samples/` is reserved for the committed demonstration fixtures)
   and push.
2. **The `intake` workflow** (`.github/workflows/intake.yml`) transforms it
   (`scripts/intake.mjs --write`), validates the result, and commits the
   draft records back to the same branch — the PR then shows both the source
   that arrived and the records it became.
3. **The required `validate` check** judges the PR like any other registry
   change; an invalid transform cannot merge.
4. Records land as `publicationStatus: "draft"`. Publication is a separate,
   human decision in a later reviewed diff.

Run it locally the same way:

```bash
npm run intake -- intake/samples/FY2026-attachment-a.csv           # dry run
npm run intake -- intake/samples/FY2026-attachment-a.xlsx --write  # merge drafts
npm run validate
```

## What intake will and will not do

- **Emits drafts only.** The transform cannot set `validated` or
  `published` — those transitions happen in reviewed diffs, by a person.
- **Never overwrites.** A row whose slug already exists in the cohort is
  skipped with a notice. Identity is immutable; corrections to a known
  record are made in `registry/FY*.json` directly, where the diff shows
  exactly what changed.
- **Appends in house style.** The registry file is hand-formatted so diffs
  read record-by-record; intake splices new records in that style and never
  reformats what a human already reviewed.
- **Stamps provenance.** If the source has no Program Record /
  Authoritative Source columns, provenance names the intake source file and
  row — the chain never has an empty link. The State program record must be
  linked before a record can responsibly publish.
- **Stamps the sample guard.** Every emitted record is `sample: true`. In
  schema v0 this is what keeps real data out of the demonstration registry;
  when a production schema version lifts the guard, intake inherits that
  decision from the schema — it is never intake's call.

## The column contract

Headers are matched loosely — case, spacing, and punctuation are ignored,
and diacritics never block a match (`Molokai` normalizes to `Molokaʻi`).
Canonical headers, with accepted aliases in parentheses:

| Column | Registry field | Required | Notes |
|---|---|---|---|
| Project Name (Project, Project Title) | `project` | yes | slug and route derive from this |
| Organization (Awardee, Grantee) | `organization` | yes | |
| Administering Agency (Agency) | `agency` | yes | |
| Island | `island` | yes | matched against the schema enum |
| Moku | `moku` | yes | stewardship context, not a regulatory district |
| Program Area (Program) | `programArea` | yes | matched against the schema enum ("Marine debris" → `marine-debris`) |
| Act 96 Alignment (Act 96 Purpose/Category) | `act96Alignment` | yes | matched against the schema enum |
| Status (Project Status) | `status` | no | defaults to `active` |
| Fiscal Year (FY) | `award.fiscalYear` | no | must match the cohort; cohort also inferable from the filename (`FY2026-…`) or `--cohort` |
| Award Amount (Amount, Award) | `award.amountUsd` | yes | `$88,000` and `88000` both accepted |
| Summary (Description) | `summary` | yes | ≥ 20 characters |
| TMK (Tax Map Key(s)) | `location.tmk` | one of TMK / Geo Context | `;` or `,` separated; empty / `n/a` → `null` |
| Geo Context (Location Note, Footprint) | `location.geoContext` | required when TMK is empty | names the non-parcel footprint |
| Program Record | `provenance.programRecord` | no | falls back to the intake source reference |
| Authoritative Source (Source) | `provenance.authoritativeSource` | no | falls back to the intake source reference |

Unknown columns are reported and ignored; a missing required column rejects
the whole source (nothing partial is ever written). Enum values that don't
match are findings with the allowed list spelled out — the same
plain-language voice as the validator.

## v1 sources: the appropriation-worksheet shape

A cohort on schema v1.0 (`docs/SCHEMA-V1.md`) accepts a far thinner source —
an appropriation line is enough to enter the registry as a draft. Required
in v1: **Project** and **Amount**, plus **Agency** or **Dept**. Additional
v1 columns (all optional; ignored with a note on a v0 registry):

| Column | Registry field | Notes |
|---|---|---|
| Dept (Department Code) | `departmentCode` | three letters: AGR, BED, LNR, TRN … |
| Program ID (Program Code) | `programId` | LNR407, BED170/KB |
| Means of Financing (MOF, Fund) | `award.meansOfFinancing` | |
| Non-recurring | `award.nonRecurring` | yes / true / x |
| Worksheet Row (Legislative Reference, Act) | `award.legislativeReference` | |
| Funding Status (Release Status) | `funding.status` | appropriated · released · encumbered · expended · lapsed |
| Released (Allotted) / Expended (Spent) / As Of | `funding.*` | `$` and commas accepted |
| Project Lead (Contact Name) + Email | `contact` | both or neither; required from `validated` onward; never exported |

Create a v1 cohort with `--v1` (add `--sample` for demonstration data,
`--fiscal-public` when the figures are enacted budget), and point every
gate at a registry outside this repository with `--registry <dir>`:

```bash
node scripts/intake.mjs worksheet.xlsx --v1 --fiscal-public --write --registry ../private-registry
node scripts/validate.mjs --registry ../private-registry
```

## PDF and legacy .xls sources: the assisted-extraction path

`intake.mjs` deliberately does not parse PDFs or binary `.xls`. Table
extraction from ~90 differently-formatted contract documents is not a
problem automation solves reliably, and a transform that is *usually* right
is the wrong tool to point at an award registry. The path for those sources
is **assisted extraction**:

1. **Extract** the award fields into the column contract above, using
   whatever tooling fits the documents — `pdftotext`/tabula for clean
   tables, LLM-assisted extraction for narrative documents, or hand entry
   for the stubborn tail. For legacy `.xls`, open and save as `.xlsx` or
   export CSV — done.
2. **Record the origin**: fill the Program Record / Authoritative Source
   columns with the source document's identifier and page, so provenance
   points at the actual paper, not at the extraction spreadsheet.
3. **Drop the resulting CSV in `intake/`** and let the same workflow, the
   same validation, and the same review judge it. Extraction quality is
   reviewed where every other registry change is reviewed: in the PR diff.

The cost model is honest: structured sources are minutes of machine time;
PDFs are hours of assisted human time — but both end in the identical gate,
which is the claim that matters: *no record enters the registry, from any
source, without validating against the schema and passing a human review.*
