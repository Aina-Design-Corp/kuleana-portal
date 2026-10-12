#!/usr/bin/env node
/**
 * Site build — gates 2–3 of the pipeline
 * (registry update → validation → MANIFEST BUILD → SITE BUILD → publication).
 *
 * Reads the validated registry and renders the static Commons Report into dist/.
 * Dependency-free: template literals + one stylesheet.
 *
 * What renders is decided per cohort:
 *   - a `fiscalPublic` cohort (enacted appropriations — public law) lists
 *     every record and builds a page for each, carrying its public-law facts
 *     and whatever has been publicly reported (`reports`);
 *   - otherwise only `published` records list and build.
 * In both cases the story and the outcomes render only for `published`
 * records — the publication gate governs the awardee's narrative and its
 * figures, never the fact of an appropriation.
 *
 * The published-manifest projection (dist/registry/<cohort>.published.json)
 * is the machine-readable public surface: exactly the records the pages
 * show, with the gated fields stripped from records the gate still holds.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRegistryDir } from './lib/registry-dir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const VERSION = 'v0.3 (FY2027 enacted cohort · schema v0.3 · schema v1.0 published)';
const MOKU_TOTAL = 33; // the moku the Mokunet shared map holds, all islands

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const usd = (n) => '$' + n.toLocaleString('en-US');
const usdM = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)} million` : usd(n);

const AREA = {
  'community-stewardship-capacity': 'Community stewardship capacity',
  'coastal-reef-resilience': 'Coastal & reef resilience',
  'watershed-freshwater-security': 'Watershed & freshwater security',
  'native-ecosystems-biosecurity': 'Native ecosystems & biosecurity',
  'wildfire-risk-reduction': 'Wildfire risk reduction',
  'water-systems-safety': 'Water systems safety',
  'hazard-ready-communities': 'Hazard-ready communities',
  'visitor-impact-management': 'Visitor-impact management',
  'enabling-planning-and-studies': 'Enabling, planning & studies',
  'monitoring-evaluation': 'Monitoring & evaluation',
};
const ALIGN = {
  'resource-protection': 'Resource protection',
  'climate-resiliency': 'Climate resiliency',
  'regenerative-tourism': 'Regenerative tourism',
};
const DEPT = {
  DOA: 'Department of Agriculture', DBEDT: 'Department of Business, Economic Development and Tourism',
  'B&F': 'Department of Budget and Finance', DCCA: 'Department of Commerce and Consumer Affairs',
  DOD: 'Department of Defense', DOE: 'Department of Education', DHHL: 'Department of Hawaiian Home Lands',
  DOH: 'Department of Health', DLE: 'Department of Law Enforcement',
  DLNR: 'Department of Land and Natural Resources', DOT: 'Department of Transportation',
  'DLNR-DOFAW': 'DLNR Division of Forestry and Wildlife', 'DLNR-DAR': 'DLNR Division of Aquatic Resources',
};
const label = (slug, dict) => dict?.[slug] ?? (slug ?? 'unassigned').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const dept = (code) => DEPT[code] ? `${esc(code)} — ${esc(DEPT[code])}` : esc(code);

// Island order for the directory: the islands first, then statewide work,
// then records whose place is not yet reported.
const ISLAND_ORDER = ['Hawaiʻi', 'Maui', 'Molokaʻi', 'Lānaʻi', 'Kahoʻolawe', 'Oʻahu', 'Kauaʻi', 'Niʻihau', 'Statewide', null];
const islandRank = (i) => { const k = ISLAND_ORDER.indexOf(i ?? null); return k < 0 ? ISLAND_ORDER.length : k; };

// --- fiscal visual -----------------------------------------------------------
// The financial transparency layer in its first form: appropriated, released,
// and expended funding by administering department. Records shown: every
// record when the cohort declares `fiscalPublic` (appropriations are enacted
// law), otherwise only what the publication gate has released. Rendered as an
// accessible SVG with the same figures in a table beneath it.
function fiscalVisual(cohort) {
  const recs = cohort.fiscalPublic
    ? cohort.records
    : cohort.records.filter((r) => r.publicationStatus === 'published');
  if (!recs.length) return '';
  const by = new Map();
  for (const r of recs) {
    const e = by.get(r.agency) ?? { appropriated: 0, released: 0, expended: 0, count: 0 };
    e.appropriated += r.award.amountUsd;
    e.released += r.funding?.releasedUsd ?? 0;
    e.expended += r.funding?.expendedUsd ?? 0;
    e.count += 1;
    by.set(r.agency, e);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].appropriated - a[1].appropriated);
  const tot = { appropriated: 0, released: 0, expended: 0, count: 0 };
  for (const [, e] of rows) for (const k of Object.keys(tot)) tot[k] += e[k];
  const max = rows[0][1].appropriated || 1;
  const W = 720, labelW = 170, valueW = 110, barW = W - labelW - valueW, rowH = 26, H = rows.length * rowH + 8;
  const svgRows = rows.map(([agency, e], i) => {
    const y = i * rowH;
    const wA = Math.max(1, Math.round((e.appropriated / max) * barW));
    const wR = Math.round((e.released / max) * barW);
    const wX = Math.round((e.expended / max) * barW);
    return `<text x="${labelW - 8}" y="${y + 17}" text-anchor="end">${esc(agency)}</text>
<rect x="${labelW}" y="${y + 4}" width="${wA}" height="18" fill="#d5dde3"/>
<rect x="${labelW}" y="${y + 4}" width="${wR}" height="18" fill="#1c5d8d"/>
<rect x="${labelW}" y="${y + 4}" width="${wX}" height="18" fill="#14364f"/>
<text x="${labelW + wA + 6}" y="${y + 17}">${usd(e.appropriated)}</text>`;
  }).join('\n');
  const tableRows = rows.map(([agency, e]) =>
    `<tr><td><abbr title="${esc(DEPT[agency] ?? agency)}">${esc(agency)}</abbr></td><td>${e.count}</td><td>${usd(e.appropriated)}</td><td>${usd(e.released)}</td><td>${usd(e.expended)}</td></tr>`
  ).join('\n');
  const scope = cohort.fiscalPublic
    ? 'all appropriated projects — enacted budget figures are public law; released and expended figures appear as departments report them'
    : 'published projects only';
  const id = `fiscal-${cohort.cohort}`;
  return `<h2>Fiscal status — ${esc(cohort.cohort)}${cohort.sample ? ' <span class="sample-chip">Sample data</span>' : ''}</h2>
<p>${tot.count} project(s) · ${usd(tot.appropriated)} appropriated · ${usd(tot.released)} released · ${usd(tot.expended)} expended
— ${scope}, as of ${esc(cohort.updated)}. Light bar: appropriated; medium: released; dark: expended.</p>
<div class="table-scroll">
<svg class="fiscal" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-table">
<title id="${id}-title">Appropriated, released, and expended Green Fee funding by administering department, ${esc(cohort.cohort)}</title>
${svgRows}
</svg>
<table id="${id}-table">
<caption>The same figures as the chart, by administering department.</caption>
<thead><tr><th scope="col">Department</th><th scope="col">Projects</th><th scope="col">Appropriated</th><th scope="col">Released</th><th scope="col">Expended</th></tr></thead>
<tbody>
${tableRows}
<tr><th scope="row">Total</th><td>${tot.count}</td><td>${usd(tot.appropriated)}</td><td>${usd(tot.released)}</td><td>${usd(tot.expended)}</td></tr>
</tbody>
</table>
</div>`;
}

// --- load cohorts ------------------------------------------------------------

const registryDir = resolveRegistryDir(root);
const cohorts = readdirSync(registryDir)
  .filter((f) => /^FY\d{4}\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(registryDir, f), 'utf8')))
  .sort((a, b) => a.cohort.localeCompare(b.cohort));

const anySample = cohorts.some((c) => c.sample === true);
const anyReal = cohorts.some((c) => c.sample !== true);

// --- shared shell ------------------------------------------------------------

const NOTICE_SAMPLE =
  '<strong>Demonstration only:</strong> every project record on this site is a ' +
  'fictional sample — no real award, awardee, or organization is represented. ' +
  'No government adoption, endorsement, partnership, or deployment is claimed. ' +
  'This Commons Report supports professional review; it makes no funding, eligibility, ' +
  'policy, or enforcement decisions.';
const NOTICE_REAL =
  '<strong>Public record, not a State surface:</strong> every project here is a Green Fee ' +
  'appropriation enacted by the Legislature and listed from the State budget worksheet. ' +
  'Places, moku, and effects appear as programs report them; nothing here is a report ' +
  'from the State. No government adoption, endorsement, partnership, or deployment is ' +
  'claimed. This Commons Report supports professional review; it makes no funding, eligibility, ' +
  'policy, or enforcement decisions.';
const noticeFor = (cohort) => (cohort ? cohort.sample === true : anySample && !anyReal) ? NOTICE_SAMPLE : NOTICE_REAL;
const kickerFor = (cohort) => cohort
  ? (cohort.sample === true ? `${esc(cohort.cohort)} · <span class="sample-chip">Sample</span>` : `${esc(cohort.cohort)} enacted cohort`)
  : (anyReal ? `${esc(cohorts.filter((c) => c.sample !== true).map((c) => c.cohort).join(', '))} enacted cohort` : '<span class="sample-chip">Sample</span>');

function page({ title, depth, body, description, cohort }) {
  const p = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(description)}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${p}styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap">
    <p class="kicker"><a href="${p}index.html">Green Fee Commons Report</a> · ${kickerFor(cohort)}</p>
    <nav class="site-nav" aria-label="Site">
      <a href="${p}index.html">Report home</a>
      <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki">Act 96 background (wiki)</a>
      <a href="https://github.com/Aina-Design-Corp/kuleana-portal">Repository</a>
    </nav>
    ${body.header}
  </div>
</header>
<main id="main">
  <div class="wrap">
    <div class="notice">${noticeFor(cohort)}</div>
    ${body.main}
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <p><strong>Green Fee Commons Report</strong> — registry-driven publication architecture, ${esc(VERSION)}.</p>
    <p>Provenance rule: public page → project record → award registry manifest → State program record → authoritative source. State systems remain authoritative; this Commons Report links to authority, it never replaces it.</p>
    <p>Kept by Āina Design Corp · moku context from the Mokunet shared map, the 33 moku of Hawaiʻi on one shared, trusted map.</p>
  </div>
</footer>
</body>
</html>
`;
}

// --- render ------------------------------------------------------------------

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'registry'), { recursive: true });
copyFileSync(join(root, 'site', 'styles.css'), join(dist, 'styles.css'));
writeFileSync(join(dist, '.nojekyll'), '');
// Custom-domain claim carried in the artifact itself (Pages CNAME file).
writeFileSync(join(dist, 'CNAME'), 'kuleana.ainadesign.org\n');

// Toolkit documents: authored as standalone print-ready pages in site/docs/.
mkdirSync(join(dist, 'docs'), { recursive: true });
for (const f of readdirSync(join(root, 'site', 'docs')).filter((f) => f.endsWith('.html'))) {
  copyFileSync(join(root, 'site', 'docs', f), join(dist, 'docs', f));
}

let directoryRows = '';
let listedCount = 0, publishedCount = 0, gatedCount = 0, totalUsd = 0, reportsCount = 0;
const mokuSet = new Set(), islandSet = new Set(), deptSet = new Set();
let islandNamed = 0;

for (const cohort of cohorts) {
  const isSample = cohort.sample === true;
  const listed = cohort.fiscalPublic
    ? cohort.records
    : cohort.records.filter((r) => r.publicationStatus === 'published');
  const published = cohort.records.filter((r) => r.publicationStatus === 'published');
  publishedCount += published.length;
  gatedCount += cohort.records.length - published.length;
  listedCount += listed.length;
  // v0 cohorts declare whether they are sample; the "(sample)" markers on
  // public pages follow the cohort, not a constant.
  const sm = isSample ? ' (sample)' : '';
  const smFig = isSample ? ' (sample figure)' : '';
  const smRef = isSample ? ' (sample reference)' : '';

  // machine-readable projection: exactly what the pages show — the gated
  // fields (story, outcomes) stripped from records the gate still holds, and
  // the submitter contact (v1) stripped from every record: accountability
  // data, never public data.
  writeFileSync(
    join(dist, 'registry', `${cohort.cohort}.published.json`),
    JSON.stringify({
      cohort: cohort.cohort,
      schemaVersion: cohort.schemaVersion ?? '0.3',
      sample: isSample,
      fiscalPublic: cohort.fiscalPublic === true,
      generated: cohort.updated,
      source: cohort.source,
      note: cohort.fiscalPublic
        ? 'Projection of the award registry manifest: every enacted appropriation is listed (public law). Story and outcomes appear only on records a person has published; reports carry their public source. Submitter contacts are never exported.'
        : 'Published-records projection of the award registry manifest. Records the publication gate holds back (draft/validated) are counted but never exported; submitter contacts are stripped from every record.',
      heldByGate: cohort.records.length - published.length,
      records: listed.map(({ contact, story, outcomes, ...pub }) =>
        pub.publicationStatus === 'published' ? { ...pub, story, outcomes } : { ...pub, outcomes: [] }),
    }, null, 2)
  );

  const sorted = [...listed].sort((a, b) =>
    islandRank(a.island) - islandRank(b.island)
    || ((a.moku == null) - (b.moku == null))
    || String(a.moku ?? '').localeCompare(String(b.moku ?? ''))
    || b.award.amountUsd - a.award.amountUsd);

  for (const r of sorted) {
    totalUsd += r.award.amountUsd;
    deptSet.add(r.agency);
    if (r.island) { islandNamed += 1; if (r.island !== 'Statewide') islandSet.add(r.island); }
    if (r.moku) for (const m of r.moku.split(/\s*&\s*/)) mokuSet.add(`${r.island ?? '?'}|${m.replace(/\s*\(.*\)$/, '')}`);
    const nReports = r.reports?.length ?? 0;
    reportsCount += nReports;
    const isPub = r.publicationStatus === 'published';

    directoryRows += `<tr>
<td><a href="projects/${r.slug}/index.html">${esc(r.project)}</a><br><small>${esc(r.organization ?? r.agency)}${r.organization ? ` · ${esc(r.agency)}` : ''}</small></td>
<td>${r.island ? esc(r.island) : '<span class="pending">to be reported</span>'}</td>
<td>${r.moku ? esc(r.moku) : '<span class="pending">to be reported</span>'}</td>
<td>${esc(label(r.programArea, AREA))}</td>
<td>${usd(r.award.amountUsd)}</td>
<td>${isPub ? 'effects published' : nReports ? `${nReports} public report${nReports === 1 ? '' : 's'}` : '<span class="pending">appropriation only</span>'}</td>
</tr>\n`;

    // project page
    const outcomes = (r.outcomes ?? []).map((o) => `<tr>
<td>${esc(o.metric)}</td><td>${o.value.toLocaleString('en-US')} ${esc(o.unit)}</td>
<td>${esc(o.period)}</td><td>${esc(o.sourceNote)}</td></tr>`).join('\n');

    const loc = r.location ?? { tmk: null, geoContext: null };
    const tmkLine = loc.tmk
      ? `<p>TMK cross-reference${sm}: ${loc.tmk.map((t) => `<code>${esc(t)}</code>`).join(', ')} —
         parcel identity only; geometry and ownership context resolve against the county and State parcel
         layers, never stored here.${loc.geoContext ? ` ${esc(loc.geoContext)}` : ''}</p>`
      : loc.geoContext
        ? `<p>${esc(loc.geoContext)}</p>`
        : '<p>Location not yet recorded.</p>';

    const arcgis = r.links.dashboardId
      ? `<p>State dashboard: <a href="#" rel="external">ArcGIS dashboard ${esc(r.links.dashboardId)}</a></p>`
      : `<p>No State dashboard destination is registered for this record. When the State registers a
         <code>dashboardId</code>, this page links out to it — the pattern is
         <em>portal page → ArcGIS dashboard</em>, with the geospatial platform remaining State-owned and authoritative.</p>`;

    const reportsHtml = nReports
      ? `<ol class="reports">${r.reports.map((rep) => `<li><time datetime="${esc(rep.date)}">${esc(rep.date)}</time> — ${esc(rep.note)}
<br><small>Source: ${rep.url ? `<a href="${esc(rep.url)}" rel="external">${esc(rep.source)}</a>` : esc(rep.source)}</small></li>`).join('\n')}</ol>`
      : `<p>Nothing has been publicly reported about this project beyond the appropriation itself. When the
         administering program announces a call for proposals, an award, or a result, it is recorded here with its source.</p>`;

    const gated = isPub
      ? `<h2>Stewardship story</h2>
<p>${esc(r.story)}</p>
<h2>Reported effects</h2>
<div class="table-scroll">
<table>
<caption>${isSample ? 'Steward-validated sample figures' : 'Figures as reported by the program'}; published through the registry's human publication gate.</caption>
<thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
<tbody>
${outcomes}
</tbody>
</table>
</div>`
      : `<h2>Stewardship story and reported effects</h2>
<div class="card gate">
<p>Not yet published. The story in the program's own words and the figures it reports appear here once the
record carries them — together with its moku — and a person publishes it
(<code>draft → validated → published</code>). This record is <strong>${esc(r.publicationStatus)}</strong>.</p>
</div>`;

    const proj = page({
      title: `${r.project} — Green Fee Commons Report${sm}`,
      description: `${isSample ? 'Sample ' : ''}Green Fee project record ${r.id}: ${r.summary.slice(0, 140)}`,
      depth: 2,
      cohort,
      body: {
        header: `<h1>${esc(r.project)}</h1>
<p class="tagline">${esc(r.summary)}</p>
<p class="meta">${esc(r.id)}${r.organization ? ` · ${esc(r.organization)}` : ''} · ${dept(r.agency)}${sm}</p>`,
        main: `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">All projects</a> → ${esc(r.project)}</nav>
<ul class="chips">
<li>Island: ${r.island ? esc(r.island) : '<span class="pending">to be reported</span>'}</li>
<li>Moku: ${r.moku ? esc(r.moku) : '<span class="pending">to be reported</span>'}</li>
<li>${esc(label(r.programArea, AREA))}</li>
<li>Act 96 alignment: ${r.act96Alignment ? esc(label(r.act96Alignment, ALIGN)) : '<span class="pending">not yet stated</span>'}${sm}</li>
<li>Status: ${esc(r.status)}</li>
</ul>
<h2>Appropriation</h2>
<p class="award">${usd(r.award.amountUsd)} <small>· ${esc(r.award.fiscalYear)}${r.award.meansOfFinancing ? ` · ${esc(r.award.meansOfFinancing)}` : ''}${r.award.nonRecurring ? ' · non-recurring' : ''}${smFig}</small></p>
${r.award.legislativeReference ? `<p><small>${esc(r.award.legislativeReference)}</small></p>` : ''}
${r.funding ? `<p>Funding status: ${esc(r.funding.status)}${r.funding.releasedUsd != null ? ` · ${usd(r.funding.releasedUsd)} released` : ''}${r.funding.expendedUsd != null ? ` · ${usd(r.funding.expendedUsd)} expended` : ''}${r.funding.asOf ? ` · as of ${esc(r.funding.asOf)}` : ''}</p>` : ''}
<h2>As reported</h2>
${reportsHtml}
${gated}
<h2>Place</h2>
${tmkLine}
${arcgis}
<h2>Provenance</h2>
<div class="card prov">
<p>Every claim on this page walks the chain:</p>
<ol>
<li>This public page (built from the registry, this commit)</li>
<li>Project record <code>${esc(r.id)}</code> (<a href="../../registry/${esc(r.award.fiscalYear)}.published.json">registry projection</a>)</li>
<li>Award Registry Manifest <code>${esc(r.award.fiscalYear)}</code> (versioned in this repository)</li>
<li>State program record: ${esc(r.provenance.programRecord)}${smRef}</li>
<li>${esc(r.provenance.authoritativeSource)}</li>
</ol>
</div>`,
      },
    });
    mkdirSync(join(dist, 'projects', r.slug), { recursive: true });
    writeFileSync(join(dist, 'projects', r.slug, 'index.html'), proj);
  }
}

// --- fiscal visual: index section + standalone embed ------------------------
// The embed is the shape of the "preliminary online visual of fiscal data":
// a self-contained page a host site can iframe or copy, no dependencies.
const fiscalHtml = cohorts.map(fiscalVisual).filter(Boolean).join('\n');
if (fiscalHtml) {
  mkdirSync(join(dist, 'fiscal'), { recursive: true });
  writeFileSync(join(dist, 'fiscal', 'embed.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Green Fee fiscal status</title>
<link rel="stylesheet" href="../styles.css">
<style>body{padding:1rem}.wrap{max-width:none;padding:0}</style>
</head>
<body>
<main id="main"><div class="wrap">
${fiscalHtml}
<p><small>Generated from the award registry manifest, ${esc(VERSION)}. Figures are as enacted and as reported to the registry; the State program record remains authoritative.</small></p>
</div></main>
</body>
</html>
`);
}

// --- index -------------------------------------------------------------------

const cohortNames = cohorts.map((c) => c.cohort).join(', ');
const realCohort = cohorts.find((c) => c.sample !== true);
const index = page({
  title: 'Green Fee Commons Report — projects by moku',
  description: 'Every Green Fee project enacted for FY2027, read in the moku it serves, with what its program reports as the work lands. A public-record stakeholder map of Hawaiʻi\'s moku, kept by Āina Design Corp.',
  depth: 0,
  body: {
    header: `<h1>Green Fee projects, by moku</h1>
<p class="tagline">Visitors to Hawaiʻi pay the Green Fee; the Legislature funded ${listedCount} projects with it for FY2027.
This Commons Report lists every one in the moku it serves — the traditional district whose community the work is for —
and records what each program reports as the work lands on the ground. Who is caring for which place, and to what
effect, kept in public record.</p>
<p class="meta">${realCohort ? `Enacted in Act 175 SLH 2026 (HB 1800) · ${listedCount} projects · ${deptSet.size} departments · ${usdM(totalUsd)}` : `${esc(VERSION)} · cohort ${esc(cohortNames)}`} · Āina Design Corp</p>`,
    main: `<h2>At a glance${anySample ? ' <span class="sample-chip">Sample data</span>' : ''}</h2>
<div class="tiles">
<div class="tile"><span class="num">${listedCount}</span><span class="lbl">Projects ${realCohort ? 'enacted' : 'published'}</span></div>
<div class="tile"><span class="num">${usd(totalUsd)}</span><span class="lbl">Appropriated${anySample ? ' (sample)' : ''}</span></div>
<div class="tile"><span class="num">${mokuSet.size} of ${MOKU_TOTAL}</span><span class="lbl">Moku named so far</span></div>
<div class="tile"><span class="num">${islandNamed} of ${listedCount}</span><span class="lbl">Projects with a place named</span></div>
<div class="tile"><span class="num">${publishedCount}</span><span class="lbl">With effects published</span></div>
</div>
<p>The place of a project is known only as far as the appropriation names it. Where the enacted title names a place,
the island — and where it is unambiguous, the moku — is read from it and marked for confirmation on the project's first
report; everywhere else the place reads <em>to be reported</em>. The map fills in from the programs, not from guesses.</p>
${fiscalHtml}
<h2>Project directory</h2>
<div class="table-scroll">
<table>
<caption>${realCohort ? 'Enacted' : 'Published'} records, ${esc(cohortNames)}, grouped by island and moku. Each project reads in its moku — the traditional district whose community it serves. The last column says what the public record holds for it so far.</caption>
<thead><tr><th scope="col">Project</th><th scope="col">Island</th><th scope="col">Moku</th><th scope="col">Program area</th><th scope="col">Appropriation</th><th scope="col">On record</th></tr></thead>
<tbody>
${directoryRows}
</tbody>
</table>
</div>
<h2>How effects are reported</h2>
<div class="card gate">
<p>Every record starts as what the Legislature enacted: a program, a title, an amount. Three things are added as they
are reported, and each is held to a different rule:</p>
<ul>
<li><strong>Reports</strong> — public notices about the project (a call for proposals, an award, a milestone), each
with its source. They are public record and appear on the project page as soon as they are recorded.</li>
<li><strong>Place</strong> — island and moku, confirmed by the program. A project's effects are counted in its moku or
not at all.</li>
<li><strong>Story and effects</strong> — the program's own account and the figures it reports. These pass the
publication gate: a record publishes only with a story, at least one reported outcome, provenance, and its moku, and
only when a person flips it (<code>draft → validated → published</code>). ${publishedCount} of ${listedCount + (realCohort ? 0 : gatedCount)} record(s) are
published today. <em>A person publishes, never an automated process.</em></li>
</ul>
<p>The <a href="registry/${esc(realCohort?.cohort ?? cohorts[0].cohort)}.published.json">machine-readable projection</a> releases exactly what the pages show.</p>
</div>
<h2>Toolkit documents</h2>
<p>The method behind the Commons Report, written to be reviewed, printed, and adapted. The documents describe the method
on the fictional FY2026 demonstration cohort, which now lives in the repository as a validator fixture; the method is
unchanged for the enacted cohort. Each document is print-ready (print to PDF from your browser); editable sources live
in the repository.</p>
<div class="docs-grid">
<div class="card"><h3><a href="docs/01-overview-replication.html">1 · Overview &amp; Replication</a></h3>
<p>The program purpose, the six-layer architecture, the replication framework, and the demonstration cohort as case study.</p></div>
<div class="card"><h3><a href="docs/02-registry-analytics-reference.html">2 · Registry &amp; Analytics Reference</a></h3>
<p>Record anatomy, the publication lifecycle, outcome metric definition rules, data-quality controls, and the provenance chain.</p></div>
<div class="card"><h3><a href="docs/03-responsible-use-public-access.html">3 · Responsible Use &amp; Public Access</a></h3>
<p>Human-review controls, permitted and prohibited uses, information boundaries, versioning, release readiness, and accessibility.</p></div>
<div class="card"><h3><a href="docs/04-direct-entry-demonstration.html">4 · Direct Entry for Geospatial Field Reporting (method prototype)</a></h3>
<p>A prototypical method for geospatial data: a plain web form, no license or app, carrying the registry's own field
names and domains, writing to a hosted ArcGIS feature layer through the REST API so the layer the map reads is the
standard field dataset. The same method is currently being applied at the Magoon Maker Lab (Hui Koʻe ʻĀina);
shown here in demonstration mode against the fictional cohort.</p></div>
</div>
<h2>How this Commons Report works</h2>
<p>Source intake → registry update → schema validation → manifest build → site build → publication. The FY2027
cohort entered from the State's own budget worksheet (assisted extraction from the PDF, every figure traced to its
page); reports, places, stories, and effects enter the same way — as a reviewed change to the registry that
validates against a versioned schema before anything builds. The schema is <strong>v0.3</strong>, the stakeholder
shape: who is caring for which moku, and what they report. Its sample guard is a declared cohort fact — a fictional
cohort says so on every page — and its parcel axis never references a real parcel; places are named in words and
resolve against State and county layers elsewhere. <strong>Schema v1.0</strong>, the program-data shape (budget join
keys, funding-release status, submitter accountability), is published in the repository and exercised by test
fixtures. The registry governs identity, cohort membership, publication eligibility, and routes; the pipeline is the
audit trail (every change is a reviewed commit); the State's ArcGIS remains the geospatial destination. Future cohorts
(<code>FY2028.json</code>, …) join the registry without redevelopment.</p>
<h2>Why this program exists</h2>
<p>The <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki">repository wiki</a> documents the historical
and legislative basis of the Green Fee — <strong>Act 96, Session Laws of Hawaiʻi 2025 (SB 1396)</strong> — from the
decade of visitor-fee proposals and the stewardship funding gap through the Climate Advisory Team's pivot to the
transient accommodations tax, plus <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki/GitHub-Pages-and-Custom-Domains">how
this Commons Report is hosted</a> and how its identity would move to a program-owned domain.</p>`,
  },
});
writeFileSync(join(dist, 'index.html'), index);

console.log(`built: ${listedCount} project page(s) + index (${publishedCount} published, ${gatedCount} held by the gate, ${reportsCount} report(s) on record), projection(s): ${cohorts.map((c) => c.cohort + '.published.json').join(', ')}`);
