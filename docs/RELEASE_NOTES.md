# Green Fee Transparency Portal — Release Notes

## Version 0.1 — August 2026 (demonstration)

Initial reviewed demonstration release containing:

- The Award Registry Manifest pattern: one schema-validated JSON cohort
  (`FY2026`, six fictional records) governing identity, cohort membership,
  publication eligibility, and routes.
- A human-held, monotonic publication gate (`draft → validated → published`)
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
