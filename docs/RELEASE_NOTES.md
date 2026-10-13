# Green Fee Commons Report — Release Notes

## Version 0.3 — 2026-10-12 (the enacted FY2027 cohort, by moku)

The Commons Report (named so on 2026-10-12; formerly the Transparency Portal) now carries public record: the 91 Green Fee projects enacted for
FY2027 in Act 175 SLH 2026 (HB 1800), listed from the State budget
worksheet, each read in the moku it serves. Purpose restated: identify the
community stakeholders of each moku and understand moku effects as they are
reported — inputs to the Mokunet shared map. Doctrine: `docs/COHORT-FY2027.md`.

- **Schema v0.3** (`schemas/registry.schema.json`) — the stakeholder shape
  kept; the sample guard becomes a declared cohort fact (`sample` boolean,
  every record must agree — validator invariant); `island`, `moku`, and
  `act96Alignment` may be null until reported; `programId`, appropriation
  detail, `status: planned`, a ten-area working taxonomy, and a sourced
  `reports` list added; `fiscalPublic` lists and pages every record while
  story and outcomes stay gated; a record cannot publish without its moku.
  The TMK guard (division 9) is unchanged — no real parcel is ever referenced.
- **Build** — a page for every enacted appropriation; *to be reported* where
  a fact is not yet known; an *As reported* section with sources; directory
  grouped by island and moku; at-a-glance count of moku named so far (of 33);
  the projection exports every listed record with gated fields stripped.
- **Intake** — inherits the cohort's `sample` declaration (`--sample` on
  creation); island, moku, and alignment columns optional; `planned` default.
- **The fictional FY2026 cohort** moves to `schemas/fixtures/v0/` and is
  validated in CI; toolkit documents 1, 2, and 4 carry a dated status note
  and are otherwise unchanged (the method they describe is unchanged).
- **Toolkit document 3 re-issued (version 0.3, 2026-10-12)** as *Public
  Accountability, Open Analysis & Responsible Use*: the Commons Report's
  purpose stated — public accountability and open analysis on published
  records — with permitted uses widened to citation, aggregation, and
  derived analysis that traces back to the projection, prohibited uses
  restated for a public-record surface, information boundaries updated for
  a `fiscalPublic` cohort, and a citation and correction rule.

### Claims and boundaries

- Every record is an enacted appropriation — public law. Nothing on the
  Commons Report is a State report; places, moku, and effects appear as
  programs report them, and every reading of a place from an enacted title
  is marked for confirmation.
- No government adoption, endorsement, partnership, or deployment is claimed.
- State systems are authoritative for every fact this Commons Report publishes.
- The Commons Report supports professional review; it makes no funding, eligibility,
  policy, or enforcement decisions.

## Version 0.1 — August 2026 (demonstration)

Initial reviewed demonstration release containing:

- The Award Registry Manifest pattern: one schema-validated JSON cohort
  (`FY2026`, six fictional records) governing identity, cohort membership,
  publication eligibility, and routes.
- A single-sourced, monotonic publication gate (`draft → validated → published`)
  with an enforced release bar (story + outcomes + provenance), demonstrated
  live: four records published, two held.
- A dependency-free validate → build pipeline; CI runs it on every change and
  a person-held deployment gate controls publication.
- The public portal: program overview, project directory, project pages with
  provenance chains, and the machine-readable published-manifest projection
  (`registry/FY2026.published.json`).
- Toolkit documents 1–3 (overview/replication, registry & analytics
  reference, responsible use & public access), portal-served and
  print-ready; editable sources in this repository.

### Claims and boundaries

- Every record, figure, organization, and story is a **fictional sample**;
  the v0 schema structurally requires the sample marking, so real data
  cannot validate against it.
- No government adoption, endorsement, partnership, or deployment is claimed.
- State systems are authoritative for every fact this architecture would
  publish; the registry is a pointer of record, not a source of record.
- The portal supports professional review; it makes no funding, eligibility,
  policy, or enforcement decisions.
- No physical signage, corridor, or field deployment is claimed.
