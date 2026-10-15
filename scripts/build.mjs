#!/usr/bin/env node
/**
 * Site build — gates 2–3 of the pipeline
 * (registry update → validation → MANIFEST BUILD → SITE BUILD → publication).
 *
 * Reads the validated registry and renders the static commons reports site into dist/.
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
const VERSION = 'v0.4 (commons reports · the Green Fee report FY2027 · rule set v0.3)';
const MOKU_TOTAL = 33; // the moku the Mokunet shared map holds, all islands
// The toolkit behind these commons reports is being generalized for community
// monitoring under a Hui Koʻe ʻĀina contract. The footer names its repository
// only once it exists and carries its CANON §7 row — set the address then, never before.
const TOOLKIT_URL = 'https://github.com/Aina-Design-Corp/moku-geospatial-survey-toolkit';
const HKA_URL = 'https://huikoeaina.ainadesign.org/';

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
const STATUS_WORDS = { planned: 'funded, not yet reported as under way', active: 'under way', completed: 'completed', withdrawn: 'withdrawn' };
const GATE_WORDS = { draft: 'not yet reviewed', validated: 'checked and waiting for approval', published: 'published' };
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
    ? 'every funded project is shown, because the enacted budget is public; released and spent amounts appear as departments report them'
    : 'approved projects only';
  const id = `fiscal-${cohort.cohort}`;
  return `<h2>Money by department — ${esc(cohort.cohort)}${cohort.sample ? ' <span class="sample-chip">Practice data</span>' : ''}</h2>
<p>${tot.count} projects · ${usd(tot.appropriated)} budgeted (appropriated by the Legislature) · ${usd(tot.released)} released · ${usd(tot.expended)} spent
— ${scope}, as of ${esc(cohort.updated)}. Light bar: budgeted. Medium: released. Dark: spent.</p>
<div class="table-scroll">
<svg class="fiscal" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-table">
<title id="${id}-title">Green Fee money budgeted, released, and spent, by department, ${esc(cohort.cohort)}</title>
${svgRows}
</svg>
<table id="${id}-table">
<caption>The same figures as the chart, by department.</caption>
<thead><tr><th scope="col">Department</th><th scope="col">Projects</th><th scope="col">Budgeted</th><th scope="col">Released</th><th scope="col">Spent</th></tr></thead>
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

// --- site identity -------------------------------------------------------------
// Kuleana is the home of commons reports: the public side of records kept in
// common by the people caring for each moku. A cohort file is one report. The
// Green Fee report (projects funded by the State's fee on visitors) is the
// first; others may or may not involve State funding.
const SITE = 'Kuleana';
const SITE_TAG = 'commons reports';
const reportSlug = (c) => `${c.program ?? 'report'}-${c.cohort.toLowerCase()}`;
const reportTitle = (c) => c.title ?? `${c.cohort} report`;

// --- shared shell ------------------------------------------------------------

const NOTICE_SAMPLE =
  '<strong>Practice data:</strong> every project on this page is made up, for learning and ' +
  'testing. No real award, group, or organization is shown. No agency has adopted or ' +
  'endorsed this site, and it decides nothing about funding, eligibility, policy, or enforcement.';
// The notice speaks to the page it is on: a report that tracks State funding
// says so plainly; the home page speaks for every report.
const noticeReal = (funded) =>
  '<strong>A record kept by the people caring for each moku, not by the State.</strong> ' +
  (funded ? 'The funded projects are' : 'Where a report tracks State funding, the funded projects are') +
  ' listed from the State\'s own budget worksheet; everything ' +
  'else — where a project is, which moku it serves, what it has done, what stewards observe — is added by the ' +
  'people who do the work, with a source. Nothing here is a State report, and no agency has adopted or ' +
  'endorsed this site. It is here so residents and visitors can see who is caring for a place and how it is ' +
  'doing; it decides nothing about funding, eligibility, policy, or enforcement.';
const noticeFor = (cohort) => (cohort ? cohort.sample === true : anySample && !anyReal)
  ? NOTICE_SAMPLE
  : noticeReal(cohort?.fiscalPublic === true);

function page({ title, depth, body, description, cohort }) {
  const p = '../'.repeat(depth);
  const crumb = cohort
    ? ` · <a href="${p}reports/${reportSlug(cohort)}/index.html">${esc(reportTitle(cohort))}</a>${cohort.sample === true ? ' · <span class="sample-chip">Practice data</span>' : ''}`
    : '';
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
    <p class="kicker"><a href="${p}index.html">${SITE}</a> · ${SITE_TAG}${crumb}</p>
    <nav class="site-nav" aria-label="Site">
      <a href="${p}index.html">Home</a>
      ${cohorts.map((c) => `<a href="${p}reports/${reportSlug(c)}/index.html">${esc(reportTitle(c))}</a>`).join('\n      ')}
      <a href="https://github.com/Aina-Design-Corp/kuleana-portal">The register and its history</a>
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
    <p><strong>${SITE} · ${SITE_TAG}</strong>, kept by Āina Design Corp until the moku stewards they are built for take them on · ${esc(VERSION)}.</p>
    <p>Every fact here traces back: this page → the record → the report's register → the source it names. Where that source is the State's, the State's record is the authority.</p>
    <p>Moku context from the Mokunet shared map, the 33 moku of Hawaiʻi on one shared, trusted map.</p>
    <p>The way of reporting used here is taught at <a href="${HKA_URL}">Hui Koʻe ʻĀina</a> (Moku Steward Training)${TOOLKIT_URL ? ` · the tools: <a href="${esc(TOOLKIT_URL)}">${esc(TOOLKIT_URL.replace(/^https:\/\/(github\.com\/)?/, ''))}</a>` : ''}.</p>
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

let publishedCount = 0, gatedCount = 0, reportsCount = 0, listedCount = 0;
const reportCards = [];

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
  const slug = reportSlug(cohort), title = reportTitle(cohort);

  // machine-readable projection: exactly what the pages show — the gated
  // fields (story, outcomes) stripped from records the gate still holds, and
  // the submitter contact (v1) stripped from every record: accountability
  // data, never public data.
  writeFileSync(
    join(dist, 'registry', `${cohort.cohort}.published.json`),
    JSON.stringify({
      cohort: cohort.cohort,
      program: cohort.program,
      title: cohort.title,
      schemaVersion: cohort.schemaVersion ?? '0.3',
      sample: isSample,
      fiscalPublic: cohort.fiscalPublic === true,
      generated: cohort.updated,
      source: cohort.source,
      note: cohort.fiscalPublic
        ? 'Projection of the register: every funded project is listed (public law). Story and outcomes appear only on records a person has published; reports carry their public source. Submitter contacts are never exported.'
        : 'Published-records projection of the register. Records the publication gate holds back (draft/validated) are counted but never exported; submitter contacts are stripped from every record.',
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

  // per-report figures
  let totalUsd = 0, islandNamed = 0, cohortReports = 0;
  const mokuSet = new Set(), deptSet = new Set();
  let directoryRows = '';

  for (const r of sorted) {
    totalUsd += r.award.amountUsd;
    deptSet.add(r.agency);
    if (r.island) islandNamed += 1;
    if (r.moku) for (const m of r.moku.split(/\s*&\s*/)) mokuSet.add(`${r.island ?? '?'}|${m.replace(/\s*\(.*\)$/, '')}`);
    const nReports = r.reports?.length ?? 0;
    cohortReports += nReports;
    const isPub = r.publicationStatus === 'published';

    directoryRows += `<tr>
<td><a href="../../projects/${r.slug}/index.html">${esc(r.project)}</a><br><small>${esc(r.organization ?? r.agency)}${r.organization ? ` · ${esc(r.agency)}` : ''}</small></td>
<td>${r.island ? esc(r.island) : '<span class="pending">to be reported</span>'}</td>
<td>${r.moku ? esc(r.moku) : '<span class="pending">to be reported</span>'}</td>
<td>${esc(label(r.programArea, AREA))}</td>
<td>${usd(r.award.amountUsd)}</td>
<td>${isPub ? 'results published' : nReports ? `${nReports} public notice${nReports === 1 ? '' : 's'}` : '<span class="pending">budget line only</span>'}</td>
</tr>\n`;

    // project page
    const outcomes = (r.outcomes ?? []).map((o) => `<tr>
<td>${esc(o.metric)}</td><td>${o.value.toLocaleString('en-US')} ${esc(o.unit)}</td>
<td>${esc(o.period)}</td><td>${esc(o.sourceNote)}</td></tr>`).join('\n');

    const loc = r.location ?? { tmk: null, geoContext: null };
    const tmkLine = loc.tmk
      ? `<p>Parcel numbers (TMK)${sm}: ${loc.tmk.map((t) => `<code>${esc(t)}</code>`).join(', ')} —
         these identify the parcel only. Boundaries and ownership live in the county and State parcel maps,
         not here.${loc.geoContext ? ` ${esc(loc.geoContext)}` : ''}</p>`
      : loc.geoContext
        ? `<p>${esc(loc.geoContext)}</p>`
        : '<p>Place not yet reported.</p>';

    const arcgis = r.links.dashboardId
      ? `<p>State map dashboard: <a href="#" rel="external">dashboard ${esc(r.links.dashboardId)}</a></p>`
      : `<p>No State map dashboard is linked yet. When the State sets one up, this page links to it. Maps and
         dashboards stay State-owned.</p>`;

    const reportsHtml = nReports
      ? `<ol class="reports">${r.reports.map((rep) => `<li><time datetime="${esc(rep.date)}">${esc(rep.date)}</time> — ${esc(rep.note)}
<br><small>Source: ${rep.url ? `<a href="${esc(rep.url)}" rel="external">${esc(rep.source)}</a>` : esc(rep.source)}</small></li>`).join('\n')}</ol>`
      : `<p>Nothing has been reported about this project yet beyond the budget line. When the program announces a
         call for proposals, an award, or a result, it is recorded here with a link to where it was said.</p>`;

    const gated = isPub
      ? `<h2>In the project's own words</h2>
<p>${esc(r.story)}</p>
<h2>Results reported</h2>
<div class="table-scroll">
<table>
<caption>${isSample ? 'Practice figures' : 'Reported by the project'}; approved by a person before publishing.</caption>
<thead><tr><th scope="col">What was measured</th><th scope="col">Amount</th><th scope="col">When</th><th scope="col">Source</th></tr></thead>
<tbody>
${outcomes}
</tbody>
</table>
</div>`
      : `<h2>In the project's own words, and results</h2>
<div class="card gate">
<p>Not yet published. When the project reports its story and its numbers, and names its moku, a person reviews
them and approves this page. Right now this record is <strong>${esc(GATE_WORDS[r.publicationStatus] ?? r.publicationStatus)}</strong>.</p>
</div>`;

    const proj = page({
      title: `${r.project} — ${title} — ${SITE}${sm}`,
      description: `${isSample ? 'Practice data. ' : ''}${title}, project ${r.id}: ${r.summary.slice(0, 140)}`,
      depth: 2,
      cohort,
      body: {
        header: `<h1>${esc(r.project)}</h1>
<p class="tagline">${esc(r.summary)}</p>
<p class="meta">${esc(r.id)}${r.organization ? ` · ${esc(r.organization)}` : ''} · ${dept(r.agency)}${sm}</p>`,
        main: `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">${SITE}</a> → <a href="../../reports/${slug}/index.html">${esc(title)}</a> → ${esc(r.project)}</nav>
<ul class="chips">
<li>Island: ${r.island ? esc(r.island) : '<span class="pending">to be reported</span>'}</li>
<li>Moku: ${r.moku ? esc(r.moku) : '<span class="pending">to be reported</span>'}</li>
<li>Kind of work: ${esc(label(r.programArea, AREA))}</li>
<li>Act 96 purpose: ${r.act96Alignment ? esc(label(r.act96Alignment, ALIGN)) : '<span class="pending">not yet stated</span>'}${sm}</li>
<li>Status: ${esc(STATUS_WORDS[r.status] ?? r.status)}</li>
</ul>
<h2>Budget</h2>
<p class="award">${usd(r.award.amountUsd)} <small>· ${esc(r.award.fiscalYear)}${r.award.meansOfFinancing ? ` · from the ${esc(r.award.meansOfFinancing)}` : ''}${r.award.nonRecurring ? ' · one-time' : ''}${smFig}</small></p>
${r.award.legislativeReference ? `<p><small>${esc(r.award.legislativeReference)}</small></p>` : ''}
${r.funding ? `<p>Money so far: ${esc(r.funding.status)}${r.funding.releasedUsd != null ? ` · ${usd(r.funding.releasedUsd)} released` : ''}${r.funding.expendedUsd != null ? ` · ${usd(r.funding.expendedUsd)} spent` : ''}${r.funding.asOf ? ` · as of ${esc(r.funding.asOf)}` : ''}</p>` : ''}
<h2>What has been reported</h2>
${reportsHtml}
${gated}
<h2>Place</h2>
${tmkLine}
${arcgis}
<h2>Where this comes from</h2>
<div class="card prov">
<p>Every fact on this page traces back through:</p>
<ol>
<li>This page, built from the register</li>
<li>The project's record <code>${esc(r.id)}</code> (in the <a href="../../registry/${esc(r.award.fiscalYear)}.published.json">data download</a>)</li>
<li>The <code>${esc(r.award.fiscalYear)}</code> register, kept with its full history</li>
<li>The State's program record: ${esc(r.provenance.programRecord)}${smRef}</li>
<li>${esc(r.provenance.authoritativeSource)}</li>
</ol>
</div>`,
      },
    });
    mkdirSync(join(dist, 'projects', r.slug), { recursive: true });
    writeFileSync(join(dist, 'projects', r.slug, 'index.html'), proj);
  }
  reportsCount += cohortReports;

  // --- the report page -------------------------------------------------------
  const fiscal = fiscalVisual(cohort);
  const isGreenFee = cohort.program === 'green-fee';
  const background = isGreenFee ? `
<h2>Where the visitor fee came from</h2>
<p>The <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki">wiki</a> tells the story behind the State's
fee on visitors, known as the Green Fee — <strong>Act 96, Session Laws of Hawaiʻi 2025 (SB 1396)</strong>: a decade
of visitor-fee proposals, the gap in funding for caring for the land, and the Climate Advisory Team's turn to the
hotel-room tax. It also explains
<a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki/GitHub-Pages-and-Custom-Domains">how these pages are
hosted</a> at their own address.</p>` : '';

  const report = page({
    title: `${title} — ${SITE}${sm}`,
    description: cohort.summary ?? `${title}: ${listed.length} projects, each in its moku, with what each reports as the work happens.`,
    depth: 2,
    cohort,
    body: {
      header: `<h1>${esc(title)}</h1>
<p class="tagline">${esc(cohort.summary ?? '')}</p>
<p class="meta">${esc(cohort.cohort)} · ${listed.length} projects · ${deptSet.size} ${isGreenFee ? 'departments' : 'organizations'} · ${usdM(totalUsd)}${isGreenFee ? ' · Act 175 SLH 2026' : ''} · published by Āina Design Corp</p>`,
      main: `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">${SITE}</a> → ${esc(title)}</nav>
<h2>At a glance${isSample ? ' <span class="sample-chip">Practice data</span>' : ''}</h2>
<div class="tiles">
<div class="tile"><span class="num">${listed.length}</span><span class="lbl">Projects ${cohort.fiscalPublic ? 'funded' : 'published'}</span></div>
<div class="tile"><span class="num">${usd(totalUsd)}</span><span class="lbl">Budgeted${isSample ? ' (practice)' : ''}</span></div>
<div class="tile"><span class="num">${mokuSet.size} of ${MOKU_TOTAL}</span><span class="lbl">Moku named so far</span></div>
<div class="tile"><span class="num">${islandNamed} of ${listed.length}</span><span class="lbl">Projects with a place named</span></div>
<div class="tile"><span class="num">${published.length}</span><span class="lbl">Projects with results published</span></div>
</div>
<p>A project's place is known only where the budget says so. When a project's name names a place, the island is
filled in, and the moku when it is clear, marked <em>confirm on first report</em>. Everywhere else it says <em>to be
reported</em>. The map fills in from the projects themselves, not from guesses.</p>
${fiscal}
<h2>The funded projects, by island and moku</h2>
<div class="table-scroll">
<table>
<caption>${cohort.fiscalPublic ? 'Projects funded' : 'Published projects'}, ${esc(cohort.cohort)}, grouped by island, then by moku. The last column says what the public record holds for each one so far.</caption>
<thead><tr><th scope="col">Project</th><th scope="col">Island</th><th scope="col">Moku</th><th scope="col">Kind of work</th><th scope="col">Budgeted</th><th scope="col">On record so far</th></tr></thead>
<tbody>
${directoryRows}
</tbody>
</table>
</div>
<h2>How a record grows</h2>
<div class="card gate">
<p>A funded project starts as a line in the budget: a program, a name, a dollar amount. Three things get added as they
come in, each with its own rule:</p>
<ul>
<li><strong>Public notices</strong> — a call for proposals, an award, a milestone — with a link to where it was said.
These go on the project's page as soon as someone records them.</li>
<li><strong>Place</strong> — the island and the moku, confirmed by the project. A project's results count in its moku,
or they do not count at all.</li>
<li><strong>Story and results</strong> — what the project says in its own words, and the numbers it reports. These
wait for review: the record needs a story, at least one result, a source, and its moku, and then a person approves it.
Today ${published.length} of ${listed.length} are approved. <em>A person publishes, never software.</em></li>
</ul>
<p>The <a href="../../registry/${esc(cohort.cohort)}.published.json">data download</a> holds exactly what the pages show.</p>
</div>${background}`,
    },
  });
  mkdirSync(join(dist, 'reports', slug), { recursive: true });
  writeFileSync(join(dist, 'reports', slug, 'index.html'), report);

  reportCards.push(`<div class="card"><h3><a href="reports/${slug}/index.html">${esc(title)}</a>${isSample ? ' <span class="sample-chip">Practice data</span>' : ''}</h3>
<p>${esc(cohort.summary ?? '')}</p>
<p><small>${listed.length} projects · ${usdM(totalUsd)} · ${mokuSet.size} of ${MOKU_TOTAL} moku named · ${published.length} with results published · ${cohortReports} public notice${cohortReports === 1 ? '' : 's'} on record</small></p></div>`);
}

// --- fiscal visual: standalone embed --------------------------------------------
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
<title>${SITE} — money by department</title>
<link rel="stylesheet" href="../styles.css">
<style>body{padding:1rem}.wrap{max-width:none;padding:0}</style>
</head>
<body>
<main id="main"><div class="wrap">
${fiscalHtml}
<p><small>Built from the register, ${esc(VERSION)}. Figures are as enacted by the Legislature and as reported since; the State's program record is the authority.</small></p>
</div></main>
</body>
</html>
`);
}

// --- home ----------------------------------------------------------------------

const index = page({
  title: `${SITE} · ${SITE_TAG} — each moku, known by the work done in it`,
  description: 'One public record of each moku of Hawaiʻi, built from the work done in it — land trusts, community groups, crews, schools, families, agencies: who is doing what, where, and what comes of it, kept in common for residents and visitors. The Green Fee report is the first of the commons reports; others may or may not involve State funding.',
  depth: 0,
  body: {
    header: `<h1>Each moku, known by the work done in it</h1>
<p class="tagline">Many hands care for each moku, the district that runs from the mountain to the sea. Their
<strong>commons reports</strong> add what they do, where, and what comes of it to one public record that keeps growing.
The first tracks the ${listedCount} projects the State's fee on visitors paid for this year; stewards' own work and what
they observe come next.</p>
<p class="meta">${cohorts.length} commons report${cohorts.length === 1 ? '' : 's'} · ${listedCount} projects on record · published by Āina Design Corp</p>`,
    main: `<h2>The commons reports</h2>
<p>A commons report is the public side of a record kept in common: who is caring for a place, what they did, what came
of it, and where each fact came from. Some reports track State funding, as the Green Fee report does. Others will track
a land trust's own work, a community group's season, or a watershed's monitoring, with no State funding involved.
Every report follows the same rules and the same review.</p>
<div class="docs-grid">
${reportCards.join('\n')}
</div>
<p>Reports that do not start from a budget line are the next thing the register will hold. They start with who the
steward is and the moku they work in; the rules for them are being written with Hui Koʻe ʻĀina, and they will enter
through the same review. None is published yet.</p>
<p>What a moku can know reaches past any one report. Researchers and community groups add water, soil, species, and
community measurements, each tied to its moku, to the
<a href="https://github.com/Aina-Design-Corp/mokulearner-research">Mokunet Research Commons</a>, whose community intake
is being tested now. It gathers more than the field survey a project uses to report its results, and that survey stays
as it is: a report says what the work did, and the research commons shows how the place is responding.</p>
<h2>How a record grows</h2>
<div class="card gate">
<p>Every record in a commons report is added in three kinds of step, each with its own rule:</p>
<ul>
<li><strong>Public notices</strong> — something said publicly about the work, with a link to where it was said. These
go on the page as soon as someone records them.</li>
<li><strong>Place</strong> — the island and the moku, confirmed by the people doing the work. Results count in their moku,
or they do not count at all.</li>
<li><strong>Story and results</strong> — the work in its own words, and the numbers it reports. These wait for review:
the record needs a story, at least one result, a source, and its moku, and then a person approves it.
<em>A person publishes, never software.</em></li>
</ul>
</div>
<p>Information arrives however it arrives. The Green Fee list came from the State's budget worksheet, a PDF read with
help and typed into the register, every figure traced to its page; a spreadsheet loads on its own. Whatever its source,
every record is checked against the same rules. The pages and each report's data download are rebuilt from the
register, so they can never disagree, and every change is kept in the history, so anyone can see what changed and who
approved it.</p>
<p>A new report is one new file. The State's maps and dashboards stay the State's; a report links to them and never
replaces them. The rules the register is checked against are published with it, along with a second rule set for a
program that wants to track budget releases and spending.</p>
<h2>How these reports are made</h2>
<p>Two documents to read, written for managers and stewards and for anyone copying the method for another place.</p>
<div class="docs-grid">
<div class="card"><h3><a href="docs/01-overview-replication.html">1 · Why these reports exist, and how to copy them</a></h3>
<p>Why the reports exist — a moku as a whole system, with funded projects as inputs among others and the
community's observations as the record of how the whole responds — who owns what, how to copy it, and a made-up year
as a worked example.</p></div>
<div class="card"><h3><a href="docs/03-responsible-use-public-access.html">3 · What a commons report is for, and the rules that keep it honest</a></h3>
<p>Holding public money and public promises to account, and letting anyone analyze the published record: who reviews
what, what anyone may do with the record, what no one may, what it never stores, and how to cite it.</p></div>
</div>
<h3>The baseline use case</h3>
<p>The first report was built as a Green Fee reporting system, and two documents from that baseline are kept for
whoever runs the tools or wants to see the method at its most concrete. They are reference material, not reading
for a steward: <a href="docs/02-registry-analytics-reference.html">Document 2, the register field by field</a>
(what each field means, the review steps, the rules for reporting a number, the automatic checks), and
<a href="docs/04-direct-entry-demonstration.html">Document 4, reporting from the field with ArcGIS Survey123</a>
(a plain web form that sends a report to the map layer with the same fields and checks as the survey form, the
method being put to work at the Magoon Maker Lab). Both use a made-up funding year as their example.</p>
<h2>Who keeps these reports</h2>
<p>Kuleana is responsibility and right together: a place that is yours to care for. The people closest to the land
are the best judges of what the numbers mean. What a steward sees on the ground is the guidance behind every figure
here, and every figure traces back to who saw it, where, and when. These reports are the first public record of
Mokunet, a network across moku, still being built, that brings together what the moku report so it can support the
care of the land. The network's community learning hub,
<a href="https://huikoeaina.ainadesign.org/">Hui Koʻe ʻĀina</a>, teaches this way of reporting in
<a href="https://huikoeaina.ainadesign.org/career-pathways">Moku Steward Training</a>, and the people in that
training are who these reports are built to be kept by. Until they take them on, Āina Design Corp keeps them.</p>
<p>Everything here is open. Anyone responsible for caring for a place and telling its story — a land trust, a community
group, a crew, a program tracking its funded projects — may take the record, the pages, the checks, and the handbook
and use them: the code under MIT, the record and the writing under CC BY 4.0.
<a href="https://github.com/Aina-Design-Corp/kuleana-portal/blob/main/CONTRIBUTING.md">How to add to it</a>, and the
<a href="https://github.com/Aina-Design-Corp/kuleana-portal/tree/main/docs/handbook">handbook</a> for project leads,
the coordinator, and reviewers.</p>`,
  },
});
writeFileSync(join(dist, 'index.html'), index);

console.log(`built: ${cohorts.length} report page(s), ${listedCount} project page(s) + home (${publishedCount} published, ${gatedCount} held by the gate, ${reportsCount} notice(s) on record), projection(s): ${cohorts.map((c) => c.cohort + '.published.json').join(', ')}`);
