# The FY2027 cohort — the enacted Green Fee projects, read by moku

**Status: public record on schema v0.3, since 2026-10-12.** Every record is
an appropriation enacted by the Legislature; nothing here is a report from
the State. Places, moku, and effects are recorded as programs report them.

## What the cohort is

The 91 Green Fee projects funded for FY2027 in **Act 175 SLH 2026** (HB
1800, the supplemental budget amending Act 250 SLH 2025): approximately
$129 million across 11 departments, as the Office of the Governor stated at
signing. The line items are taken from the Department of Budget and
Finance worksheet *Attachment A — Green Fee Projects* (published with RFP
2026-001G, August 2026) by assisted extraction from the PDF
(`docs/INTAKE.md`, the PDF path). Every record's provenance names its
worksheet page and program ID; the authoritative source is the enacted
budget itself.

Āina Design Corp proposed on RFP 2026-001G and was not awarded. The cohort
is kept because the Commons Report's purpose stands without the contract: to
identify the community stakeholders of each moku and to understand moku
effects as they are reported — inputs to the Mokunet shared map.

## What each record knows today, and what it waits for

| Field | Today | Filled in when |
|---|---|---|
| `project`, `organization`, `agency`, `programId`, `award` | From the worksheet. `organization` is the administering State program (name and ID) — the awardee as identified today | Community organizations funded under a line are recorded as they are announced (`reports`), and as their own records if the State publishes sub-awards |
| `island` | Set only where the enacted title names a place (30 of 91); `Statewide` where the title says so | The program reports it |
| `moku` | Set only where the place named is unambiguous (17 of 91), each marked *confirm on first report* in `geoContext` | The program reports it — a record cannot publish without it |
| `programArea` | This registry's working taxonomy (ten areas), assigned from the title | Corrected as programs report; the State's own methodology is authoritative over it |
| `act96Alignment` | `null` — not stated in the appropriation | The State states it |
| `location.geoContext` | The place as the title names it, or *to be reported* | The program reports it; the TMK axis stays null (the v0 guard never references a real parcel) |
| `reports` | Public notices with their source (two today: the Hoʻōla ʻĀina call for proposals, read against the two LNR906 community-stewardship lines it matches) | Any public notice: a call, an award, a milestone, a result |
| `story`, `outcomes` | Empty; every record is `draft` | The program's account and figures, published by a person once the record carries its moku |

## Rules of the cohort

- **Public-law facts render for every record.** The cohort is
  `fiscalPublic`: every appropriation lists in the directory, builds a
  page, and exports in the projection. The publication gate governs the
  story and the outcomes, never the fact of an appropriation.
- **Reading a place from a title is marked, never silent.** Every island
  or moku read from an enacted title says so in `geoContext` and asks for
  confirmation on the program's first report. Where a title names a region
  that spans moku (West Hawaiʻi, Maui Nui, the North Shore), the moku stays
  null and the region is named in words.
- **Moku names follow the Mokunet shared map** — the 33 moku of Hawaiʻi,
  with correct diacriticals. Cross-moku work names its moku as a pair
  (`Kona & Kohala`).
- **Enacted titles are kept, with diacriticals restored.** Where the
  worksheet's spelling differs beyond diacriticals (`LOKO LA`, `ANCHILANE`),
  the record's provenance carries the worksheet text verbatim.
- **Nothing is inferred into a figure.** Released and expended funds,
  outcomes, and alignment appear only as reported.

## How the cohort changes

A change is a reviewed pull request to `registry/FY2027.json` that
validates against `schemas/registry.schema.json` (v0.3) before anything
builds. Typical changes, in the order they are expected:

1. A public notice about a line — add a `reports` entry with its date,
   source, and URL.
2. A program names its place — set `island`, `moku`, and `geoContext`;
   remove the *confirm on first report* marker.
3. A program reports — add `story` and `outcomes`, then flip
   `publicationStatus` in its own diff.

Sub-awards announced by the State (for example, the Hoʻōla ʻĀina awardees
once DOFAW names them) are recorded first as a report on the line that
funds them. Whether they become records of their own is a cohort decision
taken when the State's own identifiers for them exist.
