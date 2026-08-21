# Kuleana — Green Fee Transparency Portal (proof of concept)

**Status: proof of concept in development — nothing on this site is deployed
for, adopted by, or endorsed by any government agency.**

A working demonstration of a **registry-driven publication architecture** for
environmental-stewardship program transparency, built by
[Āina Design Corp](https://ainadesign.org) as a public-benefit showcase:

- **Award Registry Manifest** — a versioned JSON registry (sample cohort)
  governs project identity, cohort membership, publication eligibility, and
  route generation. *A human publishes, never an automated process.*
- **Schema validation** — every registry change validates in CI before it can
  build.
- **GitHub Actions** — registry update → validation → manifest build → site
  build → publication. The workflow is the audit trail.
- **GitHub Pages** — the public transparency portal: program overview,
  project directory, outcome summaries, stewardship storytelling.

The architecture doctrine this demonstrates:
[`GREEN_FEE_ARCHITECTURE_BRIEF`](https://github.com/Aina-Design-Corp/mokunet-org)
(mokunet-org, `docs/coordinate/proposals/`). Development streams and scope
rules: `2026-08-21-kuleana-reset-streams.md` (same location). State systems
(ArcGIS, program records) are treated as authoritative throughout — this
portal *links to* authority, it never replaces it.

## Provenance chain (the design rule)

Public page → published project record → award registry manifest → program
record → authoritative source. Every public claim must walk that chain.

## Claims and boundaries

- All registry records here are **fictional samples** for architecture
  demonstration. No real award, awardee, or program data appears.
- No government adoption, endorsement, partnership, or deployment is claimed
  or implied.
- No physical signage, corridor, or field deployment is claimed.
- This portal supports professional review; it makes no funding,
  eligibility, policy, or enforcement decisions.

## Running it

```bash
npm run validate   # schema + registry invariants (gate 1)
npm run build      # validate, then render dist/ (publication gate applied)
npm run serve      # preview dist/ locally
```

Zero runtime dependencies: the validator interprets the JSON Schema directly
and the site renders from template literals. The CI pipeline
(`.github/workflows/publish.yml`) runs validate → build on every push; the
deploy job is additionally gated on the `PUBLISH_PAGES` repository variable +
Pages configuration — infrastructure obeying the same rule as the registry:
a person publishes, never an automated process.

## Roadmap

- **Phase 1 — SHIPPED 2026-08-21** — registry manifest (sample FY2026 cohort,
  6 records: 4 published, 2 held by the gate), JSON schema (v0 hard-requires
  `sample: true` — real data cannot validate), dependency-free
  validate/build, Actions pipeline, portal (overview + directory + project
  pages + published-manifest projection at `registry/FY2026.published.json`).
- **Phase 2** — toolkit documents (PDF + DOCX), release notes v1.0,
  screenshots; custom domain `kuleana.ainadesign.org`; Firebase hosting of
  the predecessor site sunsets after verified cutover.
- **Phase 3+** — mokulearner discovery/middleware seams, ArcGIS deep-link
  pattern, executive-analytics export samples.

## Repository layout

```
registry/    Award Registry Manifest (FY cohort JSON — sample data)
schemas/     JSON Schemas the registry validates against
site/        Static portal source (built to GitHub Pages)
docs/        Toolkit documents and release notes
.github/     Actions: validate → build → publish
```

## Lineage

The `kuleana` name carries from the parked Expo trail-guide app
(`Aina-Design-Corp/kuleana`, tag `trail-guide-v2.0.0`) — the future
corridor-experiences client. License: to be ruled before first public
release.
