# Kuleana — commons reports

**Open source, for the people caring for each moku and telling its story —
the Green Fee awardees among them.** Land trusts, community groups, crews,
program staff, project leads, stewards, reporters, students: the record, the pages, the checks, the handbook, and the
forms method here are yours to use, add to, and copy. Code under MIT, the
record and the writing under CC BY 4.0 (`LICENSE`, `LICENSE-CONTENT`). Start
with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the three ways in, and
[`docs/handbook/`](docs/handbook/) for the project-lead manual, the
coordinator runbook, and the reviewer guide.

**Status: public record, kept by Āina Design Corp — nothing on this site is
deployed for, adopted by, or endorsed by any government agency.**

Every moku — the traditional district that runs from the mountain to the
sea — is cared for by many hands: land trusts, community groups, nonprofits,
crews, schools, families, agencies. Together they are the full picture of
kuleana, the responsibility for a place. [kuleana.ainadesign.org](https://kuleana.ainadesign.org)
is the record they keep in common — who is doing what, where, and what comes
of it — for residents and visitors alike, published as **commons reports**:
one for each program or group that keeps a record this way, with or without
State funding behind it. This year the State's fee on
visitors (the Green Fee) paid for 91 projects; they are a small part of that
picture and the record's first entries, listed each in its moku with what
it reports as the work happens. The purpose: identify the stewards of each
moku and understand moku effects as they are reported, as inputs to the
Mokunet shared map. What a steward sees on the ground is the qualified
guidance behind every figure, and each figure stays traceable to who
observed it, where, and when; that reporting practice is taught at
[Hui Koʻe ʻĀina](https://huikoeaina.ainadesign.org/), the network's
community learning hub (Moku Steward Training). Mokunet gathers and analyzes
what the moku report in support of land stewardship — a connected monitoring
network across moku that is being built, with this Commons Report as its first
public record. The cohort and its rules:
[`docs/COHORT-FY2027.md`](docs/COHORT-FY2027.md).

The Commons Report is a working **registry-driven publication architecture** for
environmental-stewardship program transparency, built by
[Āina Design Corp](https://ainadesign.org):

- **Award Registry Manifest** — a versioned JSON registry governs project
  identity, cohort membership, publication eligibility, and route
  generation. *A human publishes, never an automated process.*
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
- **GitHub Pages** — the public Commons Report: the projects by island
  and moku, a page per appropriation with what has been publicly reported,
  outcome summaries and stewardship stories as programs publish them.

The architecture doctrine this demonstrates:
[`GREEN_FEE_ARCHITECTURE_BRIEF.md`](https://github.com/Aina-Design-Corp/mokunet-org/blob/main/docs/coordinate/proposals/GREEN_FEE_ARCHITECTURE_BRIEF.md)
in the `mokunet-org` repository (`docs/coordinate/proposals/`; private —
organization members only). Development streams and scope rules:
[`2026-08-21-kuleana-reset-streams.md`](https://github.com/Aina-Design-Corp/mokunet-org/blob/main/docs/coordinate/proposals/2026-08-21-kuleana-reset-streams.md)
(same location). State systems
(ArcGIS, program records) are treated as authoritative throughout — this
Commons Report *links to* authority, it never replaces it.

**Why this program exists:** the [repository wiki](https://github.com/Aina-Design-Corp/kuleana-portal/wiki)
documents the historical and legislative basis of the Green Fee — **Act 96,
Session Laws of Hawaiʻi 2025 (SB 1396)** — from the decade of visitor-fee
proposals and the $560M stewardship funding gap through the Climate Advisory
Team's pivot to the TAT and the 2025–26 litigation.

## Provenance chain (the design rule)

Public page → published project record → award registry manifest → program
record → authoritative source. Every public claim must walk that chain.

## Claims and boundaries

- Every record in `registry/FY2027.json` is a Green Fee appropriation
  **enacted in Act 175 SLH 2026 (HB 1800)**, listed from the State budget
  worksheet — public law. Nothing in the Commons Report is a State report:
  places, moku, and effects appear as programs report them, and every
  reading of a place from an enacted title is marked for confirmation. The
  cohort validates against schema **v0.3**, the stakeholder shape; schema
  **v1.0** (the program-data shape) is published here as a reviewed artifact
  and exercised by fixtures. The fictional FY2026 demonstration cohort is
  kept as a validator fixture (`schemas/fixtures/v0/`), marked sample on
  every page it would build.
- No government adoption, endorsement, partnership, or deployment is claimed
  or implied. Āina Design Corp proposed on the State's RFP 2026-001G and was
  not awarded; the Commons Report continues as public record.
- No physical signage, corridor, or field deployment is claimed.
- This Commons Report supports professional review; it makes no funding,
  eligibility, policy, or enforcement decisions.
- How the repository is governed on GitHub — the organization and repository
  controls in place today, and the enterprise pattern an adopting program
  would follow under Āina Design Corp's nonprofit licensing — is stated in
  [`docs/ENTERPRISE.md`](docs/ENTERPRISE.md), including a table of which
  controls this demonstration carries today versus what the pattern adds.

## Running it

```bash
npm run intake -- intake/samples/FY2026-attachment-a.xlsx --sample   # fixture source → draft records (gate 0; dry run, --write to merge)
npm run validate   # schema + registry invariants (gate 1), public cohort and both fixtures
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

- **FY2027 enacted cohort, by moku — SHIPPED 2026-10-12** — the 91 projects
  enacted in Act 175 SLH 2026 replace the fictional cohort on the public
  site; schema **v0.3** (sample as a declared cohort fact, place and
  alignment null until reported, sourced `reports`, `fiscalPublic` pages for
  every appropriation, moku required to publish); the FY2026 cohort becomes a
  fixture. Next: record places and effects as programs report them — the
  Hoʻōla ʻĀina awardees first (`docs/COHORT-FY2027.md`).
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
intake/      Drop zone for award data sources (.xlsx/.csv → draft records); samples/ are fixtures
registry/    Award Registry Manifest (FY2027.json — the enacted cohort, schema v0.3)
schemas/     JSON Schemas: v0.3 (stakeholder shape) and v1.0 (program-data shape) + CI fixtures
             (fixtures/v0 = the fictional FY2026 cohort; fixtures/v1 = a v1 cohort at three gate states)
site/        Static Commons Report source (built to GitHub Pages)
docs/        The handbook (handbook/: project-lead manual, coordinator runbook, reviewer guide),
             the FY2027 cohort and its rules (COHORT-FY2027.md), release notes, intake
             doctrine (INTAKE.md), schema v1 doctrine (SCHEMA-V1.md), enterprise
             governance and provisioning pattern (ENTERPRISE.md)
.github/     Actions: intake → validate → build → publish; pull-request template; issue templates
             (what has been reported · tell a project's story · correction); CODEOWNERS
```

## Lineage

The `kuleana` name carries from the parked trail-guide app
(`Aina-Design-Corp/kuleana-app`, private; tag `trail-guide-v2.0.0`), intended
as the public access guide for visitors and residents alike: corridor and
site experiences on the ground, with this Commons Report as its program-transparency
companion. That client is not yet released; nothing here depends on it.

## License

Code (`scripts/`, `schemas/`, `.github/`, `package.json`, `site/styles.css`): MIT —
`LICENSE`. The record and the writing (`registry/`, `intake/samples/`, `site/docs/`,
`docs/`, and the pages and data download built from them): CC BY 4.0 —
`LICENSE-CONTENT`, which also gives the credit line. Ruled 2026-10-12.
