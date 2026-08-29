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
import { resolveRegistryDir } from './lib/registry-dir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const VERSION = 'v0.2 (Phase 1 demonstration · schema v1.0 published)';

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const usd = (n) => '$' + n.toLocaleString('en-US');
const label = (slug) => (slug ?? 'unassigned').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// --- fiscal visual -----------------------------------------------------------
// The financial transparency layer in its first form: appropriated, released,
// and expended funding by administering agency. Records shown: every record
// when the cohort declares `fiscalPublic` (appropriations are enacted law),
// otherwise only what the publication gate has released. Rendered as an
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
    `<tr><td>${esc(agency)}</td><td>${e.count}</td><td>${usd(e.appropriated)}</td><td>${usd(e.released)}</td><td>${usd(e.expended)}</td></tr>`
  ).join('\n');
  const scope = cohort.fiscalPublic
    ? 'all appropriated projects — enacted budget figures are public facts'
    : 'published projects only';
  const id = `fiscal-${cohort.cohort}`;
  return `<h2>Fiscal status — ${esc(cohort.cohort)}${cohort.sample ? ' <span class="sample-chip">Sample data</span>' : ''}</h2>
<p>${tot.count} project(s) · ${usd(tot.appropriated)} appropriated · ${usd(tot.released)} released · ${usd(tot.expended)} expended
— ${scope}, as of ${esc(cohort.updated)}. Light bar: appropriated; medium: released; dark: expended.</p>
<div class="table-scroll">
<svg class="fiscal" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-table">
<title id="${id}-title">Appropriated, released, and expended Green Fee funding by administering agency, ${esc(cohort.cohort)}</title>
${svgRows}
</svg>
<table id="${id}-table">
<caption>The same figures as the chart, by administering agency.</caption>
<thead><tr><th scope="col">Agency</th><th scope="col">Projects</th><th scope="col">Appropriated</th><th scope="col">Released</th><th scope="col">Expended</th></tr></thead>
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
  // v0 cohorts are sample by schema; v1 cohorts say so explicitly. The
  // "(sample)" markers on public pages follow the cohort, not a constant.
  const isSample = cohort.sample === true;
  const sm = isSample ? ' (sample)' : '';
  const smFig = isSample ? ' (sample figure)' : '';
  const smRef = isSample ? ' (sample reference)' : '';

  // machine-readable projection: exactly what the gate releases — minus the
  // submitter contact, which is accountability data, never public data.
  writeFileSync(
    join(dist, 'registry', `${cohort.cohort}.published.json`),
    JSON.stringify({
      cohort: cohort.cohort,
      schemaVersion: cohort.schemaVersion ?? '0',
      sample: isSample,
      generated: cohort.updated,
      note: 'Published-records projection of the award registry manifest. Records the publication gate holds back (draft/validated) are counted but never exported; submitter contacts are stripped from every record.',
      heldByGate: gated,
      records: published.map(({ contact, ...pub }) => pub),
    }, null, 2)
  );

  for (const r of published) {
    totalUsd += r.award.amountUsd;
    if (r.moku) mokuSet.add(r.moku);
    if (r.island) islandSet.add(r.island);

    directoryRows += `<tr>
<td><a href="projects/${r.slug}/index.html">${esc(r.project)}</a><br><small>${esc(r.organization ?? r.agency)}</small></td>
<td>${esc(r.island ?? '—')}</td>
<td>${esc(r.moku ?? '—')}</td>
<td>${esc(label(r.programArea))}</td>
<td>${usd(r.award.amountUsd)}</td>
</tr>\n`;

    // project page
    const outcomes = r.outcomes.map((o) => `<tr>
<td>${esc(o.metric)}</td><td>${o.value.toLocaleString('en-US')} ${esc(o.unit)}</td>
<td>${esc(o.period)}</td><td>${esc(o.sourceNote)}</td></tr>`).join('\n');

    const loc = r.location ?? { tmk: null, geoContext: null };
    const tmkLine = loc.tmk
      ? `<p>TMK cross-reference${sm}: ${loc.tmk.map((t) => `<code>${esc(t)}</code>`).join(', ')} —
         parcel identity only; geometry and ownership context resolve against the county and State parcel
         layers, never stored here.${loc.geoContext ? ` ${esc(loc.geoContext)}` : ''}</p>`
      : loc.geoContext
        ? `<p>No TMK — ${esc(loc.geoContext)}</p>`
        : '<p>Location not yet recorded.</p>';

    const arcgis = r.links.dashboardId
      ? `<p>State dashboard: <a href="#" rel="external">ArcGIS dashboard ${esc(r.links.dashboardId)}</a></p>`
      : `<p>No State dashboard destination is registered for this record yet. When the State registers a
         <code>dashboardId</code>, this page links out to it — the pattern is
         <em>portal page → ArcGIS dashboard</em>, with the geospatial platform remaining State-owned and authoritative.</p>`;

    const proj = page({
      title: `${r.project} — Green Fee Transparency Portal${sm}`,
      description: `${isSample ? 'Sample ' : ''}Green Fee project record ${r.id}: ${r.summary.slice(0, 140)}`,
      depth: 2,
      body: {
        header: `<h1>${esc(r.project)}</h1>
<p class="tagline">${esc(r.summary)}</p>
<p class="meta">${esc(r.id)}${r.organization ? ` · ${esc(r.organization)}` : ''} · administering agency ${esc(r.agency)}${r.programId ? ` · program ${esc(r.programId)}` : ''}${sm}</p>`,
        main: `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">All projects</a> → ${esc(r.project)}</nav>
<ul class="chips">
<li>Island: ${esc(r.island ?? '—')}</li>
${r.moku ? `<li>Moku: ${esc(r.moku)}</li>` : ''}
<li>${esc(label(r.programArea))}</li>
<li>Act 96 alignment: ${esc(label(r.act96Alignment))}${sm}</li>
<li>Status: ${esc(r.status)}</li>
</ul>
<h2>Award</h2>
<p class="award">${usd(r.award.amountUsd)} <small>· ${esc(r.award.fiscalYear)}${r.award.meansOfFinancing ? ` · ${esc(r.award.meansOfFinancing)}` : ''}${r.award.nonRecurring ? ' · non-recurring' : ''}${smFig}</small></p>
${r.funding ? `<p>Funding status: ${esc(r.funding.status)}${r.funding.releasedUsd != null ? ` · ${usd(r.funding.releasedUsd)} released` : ''}${r.funding.expendedUsd != null ? ` · ${usd(r.funding.expendedUsd)} expended` : ''}${r.funding.asOf ? ` · as of ${esc(r.funding.asOf)}` : ''}</p>` : ''}
<h2>Stewardship story</h2>
<p>${esc(r.story)}</p>
<h2>Reported outcomes</h2>
<div class="table-scroll">
<table>
<caption>${isSample ? 'Steward-validated sample figures' : 'Project-lead-reported figures, State-reviewed'}; published through the registry's human publication gate.</caption>
<thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
<tbody>
${outcomes}
</tbody>
</table>
</div>
<h2>Location and maps</h2>
${tmkLine}
${arcgis}
<h2>Provenance</h2>
<div class="card prov">
<p>Every claim on this page walks the chain:</p>
<ol>
<li>This public page (built from the registry, this commit)</li>
<li>Published project record <code>${esc(r.id)}</code> (<a href="../../registry/${esc(r.award.fiscalYear)}.published.json">published manifest projection</a>)</li>
<li>Award Registry Manifest <code>${esc(r.award.fiscalYear)}</code> (versioned in this repository)</li>
<li>State program record <code>${esc(r.provenance.programRecord)}</code>${smRef}</li>
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
<p><small>Generated from the award registry manifest, ${esc(VERSION)}. Figures are as reported to the registry; the State program record remains authoritative.</small></p>
</div></main>
</body>
</html>
`);
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
${fiscalHtml}
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
<p>Source intake → registry update → schema validation → manifest build → site build → publication. Award data
enters however it arrives: a spreadsheet export transforms into draft records automatically, and documents walk an
assisted-extraction path into the same format — whatever the source, every record passes the same schema validation
and the same human publication decision before it appears here. The registry validates against a
versioned schema: this demonstration cohort uses <strong>v0</strong>, whose sample guard keeps real data out by
construction; <strong>schema v1.0</strong>, the program-data shape (minimal at draft, complete at publication; fiscal
facts public, stories gated), is published in the repository and exercised by test fixtures. The registry governs identity,
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
