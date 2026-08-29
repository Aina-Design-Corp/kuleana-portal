# Kuleana — Green Fee Transparency Portal (proof of concept)

**Status: proof of concept in development — nothing on this site is deployed
for, adopted by, or endorsed by any government agency.**

A working demonstration of a **registry-driven publication architecture** for
environmental-stewardship program transparency, built by
[Āina Design Corp](https://ainadesign.org) as a public-benefit showcase:

- **Award Registry Manifest** — a versioned JSON registry (sample cohort)
  governs project identity, cohort membership, publication eligibility, and
  route generation. *A human publishes, never an automated process.*
- **Source-agnostic intake** — award data arrives as it arrives: `.xlsx` and
  `.csv` sources transform to *draft* records in CI (`intake/` →
  `scripts/intake.mjs`); PDFs and legacy `.xls` walk a documented
  assisted-extraction path into the same column contract
  ([`docs/INTAKE.md`](docs/INTAKE.md)). Every record, from any source,
  passes the same validation gate and the same human publication decision —
  messier sources cost more human minutes, never a weaker gate.
- **Schema validation** — every registry change validates in CI, and the
  `validate` check is required to merge: an invalid registry cannot reach
  `main`. Findings appear directly on the pull request — a plain-language job
  summary plus annotations on the offending `registry/*.json` file.
- **GitHub Actions** — source intake → registry update → validation →
  manifest build → site build → publication. The workflow is the audit
  trail.
- **GitHub Pages** — the public transparency portal: program overview,
  project directory, outcome summaries, stewardship storytelling.

The architecture doctrine this demonstrates:
[`GREEN_FEE_ARCHITECTURE_BRIEF`](https://github.com/Aina-Design-Corp/mokunet-org)
(mokunet-org, `docs/coordinate/proposals/`). Development streams and scope
rules: `2026-08-21-kuleana-reset-streams.md` (same location). State systems
(ArcGIS, program records) are treated as authoritative throughout — this
portal *links to* authority, it never replaces it.

**Why this program exists:** the [repository wiki](https://github.com/Aina-Design-Corp/kuleana-portal/wiki)
documents the historical and legislative basis of the Green Fee — **Act 96,
Session Laws of Hawaiʻi 2025 (SB 1396)** — from the decade of visitor-fee
proposals and the $560M stewardship funding gap through the Climate Advisory
Team's pivot to the TAT and the 2025–26 litigation.

## Provenance chain (the design rule)

Public page → published project record → award registry manifest → program
record → authoritative source. Every public claim must walk that chain.

## Claims and boundaries

- All registry records here are **fictional samples** for architecture
  demonstration. No real award, awardee, or program data appears. The
  public cohort validates against schema **v0**, whose sample guard makes
  real data unable to validate; schema **v1.0** (the production shape) is
  published here as a reviewed artifact and exercised only by fixtures.
- No government adoption, endorsement, partnership, or deployment is claimed
  or implied.
- No physical signage, corridor, or field deployment is claimed.
- This portal supports professional review; it makes no funding,
  eligibility, policy, or enforcement decisions.

## Running it

```bash
npm run intake -- intake/samples/FY2026-attachment-a.xlsx   # source → draft records (gate 0; dry run, --write to merge)
npm run validate   # schema + registry invariants (gate 1)
npm run build      # validate, then render dist/ (publication gate applied)
npm run serve      # preview dist/ locally
```

Zero runtime dependencies: the validator interprets the JSON Schema directly,
the site renders from template literals, and the intake transform reads
`.xlsx` with node built-ins alone (ZIP walk + sheet XML — no parser
library). The CI pipeline
(`.github/workflows/publish.yml`) runs validate → build on every push; the
deploy job is additionally gated on the `PUBLISH_PAGES` repository variable +
Pages configuration — infrastructure obeying the same rule as the registry:
a person publishes, never an automated process. Branch protection adds a
third instance of that rule: the `validate` check is required on `main`, so
an invalid registry cannot merge, and findings surface on the pull request
itself (job summary in plain language, per-file annotations).

## Roadmap

- **Phase 1 — SHIPPED 2026-08-21** — registry manifest (sample FY2026 cohort,
  6 records: 4 published, 2 held by the gate), JSON schema (v0 hard-requires
  `sample: true` — real data cannot validate), dependency-free
  validate/build, Actions pipeline, portal (overview + directory + project
  pages + published-manifest projection at `registry/FY2026.published.json`).
- **Schema v1.0 — SHIPPED 2026-08-29** — the versioned change v0 promised:
  the program-data shape (`schemas/registry.v1.schema.json`) — sample guard
  becomes optional, real TMK divisions, budget join keys, funding-release
  status, submitter contact (never exported), *minimal at draft, complete at
  publication* enforced by the validator; fiscal visual (index section +
  `fiscal/embed.html`); `--registry <dir>` on every script so the identical
  gates run against a cohort kept outside this repo; CI fixture. The public
  demonstration cohort stays on v0. Doctrine: `docs/SCHEMA-V1.md`.
- **Intake pipeline — SHIPPED 2026-08-24** — source-agnostic intake:
  dependency-free `.xlsx`/`.csv` transform to draft records
  (`scripts/intake.mjs`), branch-drop workflow
  (`.github/workflows/intake.yml`: transform → validate → commit back →
  reviewed PR), CSV↔XLSX parity check in CI, assisted-extraction doctrine
  for PDF and legacy `.xls` sources (`docs/INTAKE.md`).
- **Phase 2** — toolkit documents (PDF + DOCX), release notes v1.0,
  screenshots; custom domain `kuleana.ainadesign.org`; Firebase hosting of
  the predecessor site sunsets after verified cutover.
- **Phase 3+** — mokulearner discovery/middleware seams, ArcGIS deep-link
  pattern, executive-analytics export samples.

## Repository layout

```
intake/      Drop zone for award data sources (.xlsx/.csv → draft records)
registry/    Award Registry Manifest (FY cohort JSON — sample data, schema v0)
schemas/     JSON Schemas: v0 (demonstration guard) and v1.0 (program-data shape) + CI fixtures
site/        Static portal source (built to GitHub Pages)
docs/        Toolkit documents, release notes, intake doctrine (INTAKE.md)
.github/     Actions: intake → validate → build → publish
```

## Lineage

The `kuleana` name carries from the parked Expo trail-guide app
(`Aina-Design-Corp/kuleana`, tag `trail-guide-v2.0.0`) — the future
corridor-experiences client. License: to be ruled before first public
release.
