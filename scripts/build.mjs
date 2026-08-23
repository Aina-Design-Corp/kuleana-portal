#!/usr/bin/env node
/**
 * Site build — gates 2–3 of the pipeline
 * (registry update → validation → MANIFEST BUILD → SITE BUILD → publication).
 *
 * Reads the validated registry, applies the publication gate (only
 * `published` records build pages or export), and renders the static portal
 * into dist/. Dependency-free: template literals + one stylesheet.
 *
 * The published-manifest projection (dist/registry/<cohort>.published.json)
 * is the machine-readable public surface: exactly the records the pages show,
 * nothing the gate holds back.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const VERSION = 'v0.1 (Phase 1 demonstration)';

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const usd = (n) => '$' + n.toLocaleString('en-US');
const label = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// --- load cohorts ------------------------------------------------------------

const registryDir = join(root, 'registry');
const cohorts = readdirSync(registryDir)
  .filter((f) => /^FY\d{4}\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(registryDir, f), 'utf8')))
  .sort((a, b) => a.cohort.localeCompare(b.cohort));

// --- shared shell ------------------------------------------------------------

const NOTICE =
  '<strong>Demonstration only:</strong> every project record on this site is a ' +
  'fictional sample — no real award, awardee, or organization is represented. ' +
  'No government adoption, endorsement, partnership, or deployment is claimed. ' +
  'This portal supports professional review; it makes no funding, eligibility, ' +
  'policy, or enforcement decisions.';

function page({ title, depth, body, description }) {
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
    <p class="kicker"><a href="${p}index.html">Green Fee Transparency Portal</a> · <span class="sample-chip">Sample</span></p>
    <nav class="site-nav" aria-label="Site">
      <a href="${p}index.html">Portal home</a>
      <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki">Act 96 background (wiki)</a>
      <a href="https://github.com/Aina-Design-Corp/kuleana-portal">Repository</a>
    </nav>
    ${body.header}
  </div>
</header>
<main id="main">
  <div class="wrap">
    <div class="notice">${NOTICE}</div>
    ${body.main}
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <p><strong>Green Fee Transparency Portal</strong> — registry-driven publication architecture, demonstration ${esc(VERSION)}.</p>
    <p>Provenance rule: public page → published project record → award registry manifest → State program record → authoritative source. State systems remain authoritative; this portal links to authority, it never replaces it.</p>
    <p>Methodology demonstration by Āina Design Corp · moku stewardship context via the Mokunet network.</p>
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
let publishedCount = 0, gatedCount = 0, totalUsd = 0;
const mokuSet = new Set(), islandSet = new Set();

for (const cohort of cohorts) {
  const published = cohort.records.filter((r) => r.publicationStatus === 'published');
  const gated = cohort.records.length - published.length;
  publishedCount += published.length;
  gatedCount += gated;

  // machine-readable projection: exactly what the gate releases
  writeFileSync(
    join(dist, 'registry', `${cohort.cohort}.published.json`),
    JSON.stringify({
      cohort: cohort.cohort,
      sample: true,
      generated: cohort.updated,
      note: 'Published-records projection of the award registry manifest. Records the publication gate holds back (draft/validated) are counted but never exported.',
      heldByGate: gated,
      records: published,
    }, null, 2)
  );

  for (const r of published) {
    totalUsd += r.award.amountUsd;
    mokuSet.add(r.moku);
    islandSet.add(r.island);

    directoryRows += `<tr>
<td><a href="projects/${r.slug}/index.html">${esc(r.project)}</a><br><small>${esc(r.organization)}</small></td>
<td>${esc(r.island)}</td>
<td>${esc(r.moku)}</td>
<td>${esc(label(r.programArea))}</td>
<td>${usd(r.award.amountUsd)}</td>
</tr>\n`;

    // project page
    const outcomes = r.outcomes.map((o) => `<tr>
<td>${esc(o.metric)}</td><td>${o.value.toLocaleString('en-US')} ${esc(o.unit)}</td>
<td>${esc(o.period)}</td><td>${esc(o.sourceNote)}</td></tr>`).join('\n');

    const arcgis = r.links.dashboardId
      ? `<p>State dashboard: <a href="#" rel="external">ArcGIS dashboard ${esc(r.links.dashboardId)}</a></p>`
      : `<p>No State dashboard destination is registered for this record yet. When the State registers a
         <code>dashboardId</code>, this page links out to it — the pattern is
         <em>portal page → ArcGIS dashboard</em>, with the geospatial platform remaining State-owned and authoritative.</p>`;

    const proj = page({
      title: `${r.project} — Green Fee Transparency Portal (sample)`,
      description: `Sample Green Fee project record ${r.id}: ${r.summary.slice(0, 140)}`,
      depth: 2,
      body: {
        header: `<h1>${esc(r.project)}</h1>
<p class="tagline">${esc(r.summary)}</p>
<p class="meta">${esc(r.id)} · ${esc(r.organization)} · administering agency ${esc(r.agency)} (sample)</p>`,
        main: `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">All projects</a> → ${esc(r.project)}</nav>
<ul class="chips">
<li>Island: ${esc(r.island)}</li>
<li>Moku: ${esc(r.moku)}</li>
<li>${esc(label(r.programArea))}</li>
<li>Act 96 alignment: ${esc(label(r.act96Alignment))} (sample)</li>
<li>Status: ${esc(r.status)}</li>
</ul>
<h2>Award</h2>
<p class="award">${usd(r.award.amountUsd)} <small>· ${esc(r.award.fiscalYear)} (sample figure)</small></p>
<h2>Stewardship story</h2>
<p>${esc(r.story)}</p>
<h2>Reported outcomes</h2>
<div class="table-scroll">
<table>
<caption>Steward-validated sample figures; published through the registry's human publication gate.</caption>
<thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
<tbody>
${outcomes}
</tbody>
</table>
</div>
<h2>Maps and dashboards</h2>
${arcgis}
<h2>Provenance</h2>
<div class="card prov">
<p>Every claim on this page walks the chain:</p>
<ol>
<li>This public page (built from the registry, this commit)</li>
<li>Published project record <code>${esc(r.id)}</code> (<a href="../../registry/${esc(r.award.fiscalYear)}.published.json">published manifest projection</a>)</li>
<li>Award Registry Manifest <code>${esc(r.award.fiscalYear)}</code> (versioned in this repository)</li>
<li>State program record <code>${esc(r.provenance.programRecord)}</code> (sample reference)</li>
<li>${esc(r.provenance.authoritativeSource)}</li>
</ol>
</div>`,
      },
    });
    mkdirSync(join(dist, 'projects', r.slug), { recursive: true });
    writeFileSync(join(dist, 'projects', r.slug, 'index.html'), proj);
  }
}

// --- index -------------------------------------------------------------------

const index = page({
  title: 'Green Fee Transparency Portal — demonstration',
  description: 'Demonstration of a registry-driven publication architecture for environmental stewardship program transparency: award registry, validation, human publication gate, static public portal.',
  depth: 0,
  body: {
    header: `<h1>Resiliency projects and actions report</h1>
<p class="tagline">A demonstration transparency portal: every project page is generated from a versioned, schema-validated
<strong>Award Registry Manifest</strong> and traceable to its authoritative
State record. Visitors fund stewardship; this is the architecture that shows them what it built.</p>
<p class="meta">${esc(VERSION)} · sample cohort FY2026 · Āina Design Corp</p>`,
    main: `<h2>Program at a glance <span class="sample-chip">Sample data</span></h2>
<div class="tiles">
<div class="tile"><span class="num">${publishedCount}</span><span class="lbl">Published projects</span></div>
<div class="tile"><span class="num">${usd(totalUsd)}</span><span class="lbl">Published sample awards</span></div>
<div class="tile"><span class="num">${islandSet.size}</span><span class="lbl">Islands</span></div>
<div class="tile"><span class="num">${mokuSet.size}</span><span class="lbl">Moku served</span></div>
</div>
<h2>Project directory</h2>
<div class="table-scroll">
<table>
<caption>Published sample records, ${esc(cohorts.map((c) => c.cohort).join(', '))}. Each project reads in its moku — the traditional land division whose community it serves.</caption>
<thead><tr><th scope="col">Project</th><th scope="col">Island</th><th scope="col">Moku</th><th scope="col">Program area</th><th scope="col">Award</th></tr></thead>
<tbody>
${directoryRows}
</tbody>
</table>
</div>
<h2>The publication gate</h2>
<div class="card gate">
<p>The FY2026 sample registry holds <strong>${publishedCount + gatedCount} records</strong>; <strong>${publishedCount} are published</strong> and appear above.
<strong>${gatedCount} remain draft or validated</strong> — they are counted, but they build no pages and export in no feed.
Publication is monotonic (<code>draft → validated → published</code>) and human-held: <em>a person publishes, never an
automated process</em>. The <a href="registry/FY2026.published.json">machine-readable projection</a> releases exactly what the pages show.</p>
</div>
<h2>Toolkit documents</h2>
<p>The method behind the portal, written to be reviewed, printed, and adapted. Each document is
print-ready (print to PDF from your browser); editable sources live in the repository.</p>
<div class="docs-grid">
<div class="card"><h3><a href="docs/01-overview-replication.html">1 · Overview &amp; Replication</a></h3>
<p>The program purpose, the six-layer architecture, the replication framework, and the FY2026 demonstration cohort as case study.</p></div>
<div class="card"><h3><a href="docs/02-registry-analytics-reference.html">2 · Registry &amp; Analytics Reference</a></h3>
<p>Record anatomy, the publication lifecycle, outcome metric definition rules, data-quality controls, and the provenance chain.</p></div>
<div class="card"><h3><a href="docs/03-responsible-use-public-access.html">3 · Responsible Use &amp; Public Access</a></h3>
<p>Human-review controls, permitted and prohibited uses, information boundaries, versioning, release readiness, and accessibility.</p></div>
</div>
<h2>How this portal works</h2>
<p>Registry update → schema validation → manifest build → site build → publication. The registry governs identity,
cohort membership, publication eligibility, and routes; the pipeline is the audit trail (every published change is a
reviewed commit); the State's ArcGIS remains the geospatial destination and Power BI the executive-analytics layer.
Future funding cohorts (<code>FY2027.json</code>, …) join the registry without dashboard redevelopment.</p>
<h2>Why this program exists</h2>
<p>The <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki">repository wiki</a> documents the historical
and legislative basis of the Green Fee — <strong>Act 96, Session Laws of Hawaiʻi 2025 (SB 1396)</strong> — from the
decade of visitor-fee proposals and the stewardship funding gap through the Climate Advisory Team's pivot to the
transient accommodations tax, plus <a href="https://github.com/Aina-Design-Corp/kuleana-portal/wiki/GitHub-Pages-and-Custom-Domains">how
this demonstration is hosted</a> and how its identity would move to a program-owned domain.</p>`,
  },
});
writeFileSync(join(dist, 'index.html'), index);

console.log(`built: ${publishedCount} project page(s) + index, ${gatedCount} record(s) held by the gate, projection(s): ${cohorts.map((c) => c.cohort + '.published.json').join(', ')}`);
