#!/usr/bin/env node
/**
 * Intake transform — gate 0 of the pipeline
 * (SOURCE INTAKE → registry update → validation → manifest build → site
 * build → publication).
 *
 * Turns a structured source file — .xlsx or .csv, the shapes award data
 * actually arrives in — into draft registry records. The transform is
 * deliberately dumb about trust: everything it emits is `publicationStatus:
 * "draft"`, everything it emits is `sample: true` (the v0 schema guard), and
 * it never touches a record that already exists. Intake proposes; the
 * validation gate judges; a human publishes.
 *
 * Dependency-free on purpose, like the validator: the .xlsx reader walks the
 * ZIP container and sheet XML with node built-ins only, so intake runs
 * anywhere with zero install. Legacy binary .xls and PDF sources are not
 * parsed here — they walk the assisted-extraction path (docs/INTAKE.md) into
 * this same column contract as CSV.
 *
 * Usage:
 *   node scripts/intake.mjs <source.xlsx|source.csv> [--write] [--json] [--cohort FY2026]
 *
 * Default is a dry run: prints the transform report and the records it would
 * add. --write merges them into registry/FY<year>.json (run `npm run
 * validate` after, or let CI do it). --json prints the generated records as
 * JSON on stdout (report moves to stderr) so two source formats can be
 * diffed for parity.
 *
 * Exit code 0 = transform clean (skips allowed); 1 = findings.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schemas', 'registry.schema.json'), 'utf8'));
const recordSchema = schema.$defs.record.properties;

// Enums come from the schema, never restated here — the schema stays the
// single source of truth for what the registry accepts.
const ENUMS = {
  island: recordSchema.island.enum,
  programArea: recordSchema.programArea.enum,
  act96Alignment: recordSchema.act96Alignment.enum,
  status: recordSchema.status.enum,
};

// --- text normalization ------------------------------------------------------

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036fʻ‘’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Match a human-typed value ("Marine debris", "Molokai") against a schema
// enum by comparing slugified forms — diacritics and case never block intake.
function matchEnum(value, options) {
  const key = slugify(value);
  return options.find((o) => slugify(o) === key) ?? null;
}

function decodeXml(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// --- CSV reader --------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// --- XLSX reader (ZIP container + sheet XML, node built-ins only) ------------

function readZipEntries(buf) {
  // End-of-central-directory record: scan back from the tail (max comment 64K).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a .xlsx file (no ZIP end-of-central-directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('corrupt ZIP central directory');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // Local header repeats name/extra lengths; data starts after them.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, { method, raw });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    if (e.method === 0) return e.raw.toString('utf8');
    if (e.method === 8) return inflateRawSync(e.raw).toString('utf8');
    throw new Error(`${name}: unsupported ZIP compression method ${e.method}`);
  };
}

function colIndex(ref) {
  let n = 0;
  for (const ch of ref) {
    if (ch >= '0' && ch <= '9') break;
    n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseXlsx(buf) {
  const entry = readZipEntries(buf);
  const sharedXml = entry('xl/sharedStrings.xml') ?? '';
  const shared = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(([, si]) =>
    [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(([, t]) => decodeXml(t)).join('')
  );
  const sheetName =
    entry('xl/worksheets/sheet1.xml') != null
      ? 'xl/worksheets/sheet1.xml'
      : null;
  if (!sheetName) throw new Error('no xl/worksheets/sheet1.xml in workbook');
  const sheetXml = entry(sheetName);
  const rows = [];
  for (const [, rowXml] of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    let auto = 0;
    for (const m of rowXml.matchAll(/<c([^>]*)\/>|<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = m[1] ?? m[2] ?? '';
      const inner = m[3] ?? '';
      const ref = /\br="([A-Z]+[0-9]+)"/.exec(attrs)?.[1];
      const idx = ref ? colIndex(ref) : auto;
      auto = idx + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
      let value = '';
      if (type === 'inlineStr') {
        value = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(([, t]) => decodeXml(t)).join('');
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
        value = type === 's' ? (shared[Number(v)] ?? '') : decodeXml(v);
      }
      cells[idx] = value;
    }
    rows.push(Array.from(cells, (c) => c ?? ''));
  }
  return rows.filter((r) => r.some((f) => String(f).trim() !== ''));
}

// --- column contract ---------------------------------------------------------
// Headers are matched loosely (case, spacing, punctuation ignored). The
// canonical contract lives in docs/INTAKE.md; aliases cover the shapes a
// program office is likely to send.

const HEADER_MAP = {
  project: ['project', 'projectname', 'projecttitle'],
  organization: ['organization', 'awardee', 'organizationawardee', 'grantee'],
  agency: ['agency', 'administeringagency'],
  island: ['island'],
  moku: ['moku'],
  programArea: ['programarea', 'program'],
  act96Alignment: ['act96alignment', 'act96purpose', 'act96category', 'alignment'],
  status: ['status', 'projectstatus'],
  fiscalYear: ['fiscalyear', 'fy'],
  amountUsd: ['awardamount', 'amount', 'amountusd', 'award'],
  summary: ['summary', 'description', 'projectdescription'],
  tmk: ['tmk', 'tmks', 'taxmapkey', 'taxmapkeys'],
  geoContext: ['geocontext', 'locationnote', 'geographiccontext', 'footprint'],
  programRecord: ['programrecord'],
  authoritativeSource: ['authoritativesource', 'source', 'sourcerecord'],
};

function mapHeaders(headerRow, findings, warnings) {
  const fields = new Array(headerRow.length).fill(null);
  const seen = new Set();
  headerRow.forEach((h, i) => {
    const key = slugify(String(h)).replace(/-/g, '');
    if (!key) return;
    const field = Object.keys(HEADER_MAP).find((f) => HEADER_MAP[f].includes(key));
    if (!field) {
      // Real exports carry columns the registry doesn't model (contacts,
      // internal notes). Ignoring them is normal — but say so out loud.
      warnings.push(`header "${h}": no matching registry field — column ignored (see docs/INTAKE.md for the contract)`);
      return;
    }
    if (seen.has(field)) findings.push(`header "${h}": duplicate mapping for "${field}"`);
    seen.add(field);
    fields[i] = field;
  });
  for (const required of ['project', 'organization', 'agency', 'island', 'moku', 'programArea', 'act96Alignment', 'amountUsd', 'summary']) {
    if (!seen.has(required)) findings.push(`source is missing a column for required field "${required}"`);
  }
  return fields;
}

// --- record synthesis --------------------------------------------------------

function nextIdNumber(records, year) {
  let max = 0;
  for (const r of records) {
    const m = new RegExp(`^GF-${year}-HI-([0-9]{3})$`).exec(r.id ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

function toRecord(raw, ctx, at, findings) {
  const get = (f) => (raw[f] ?? '').toString().trim();
  const record = {};
  const fail = (msg) => { findings.push(`${at}: ${msg}`); };

  const project = get('project');
  if (!project) return fail('no project name — row skipped');

  const island = matchEnum(get('island'), ENUMS.island);
  if (!island) fail(`island "${get('island')}" not one of [${ENUMS.island.join(', ')}]`);
  const programArea = matchEnum(get('programArea'), ENUMS.programArea);
  if (!programArea) fail(`program area "${get('programArea')}" not one of [${ENUMS.programArea.join(', ')}]`);
  const act96 = matchEnum(get('act96Alignment'), ENUMS.act96Alignment);
  if (!act96) fail(`Act 96 alignment "${get('act96Alignment')}" not one of [${ENUMS.act96Alignment.join(', ')}]`);
  const status = get('status') ? matchEnum(get('status'), ENUMS.status) : 'active';
  if (!status) fail(`status "${get('status')}" not one of [${ENUMS.status.join(', ')}]`);

  const amount = Number(get('amountUsd').replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount) || amount < 0) fail(`award amount "${get('amountUsd')}" is not a non-negative number`);

  const fyRaw = get('fiscalYear');
  const fy = fyRaw ? (/^(FY)?(\d{4})$/.exec(fyRaw) ? `FY${/(\d{4})$/.exec(fyRaw)[1]}` : null) : ctx.cohort;
  if (!fy) fail(`fiscal year "${fyRaw}" is not FYxxxx`);
  else if (fy !== ctx.cohort) fail(`fiscal year ${fy} does not match cohort ${ctx.cohort}`);

  const tmkRaw = get('tmk');
  const tmk = !tmkRaw || /^(n\/?a|none|—|-)$/i.test(tmkRaw)
    ? null
    : tmkRaw.split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean);
  const geoContext = get('geoContext') || null;
  if (tmk === null && !geoContext) fail('no TMK and no geo context — a non-parcel footprint must be named');

  const summary = get('summary');
  if (summary.length < 20) fail('summary is missing or shorter than 20 characters');

  record.id = `GF-${ctx.year}-HI-${String(++ctx.idCounter).padStart(3, '0')}`;
  record.slug = slugify(project);
  record.sample = true; // v0 schema guard: intake can only ever propose sample records
  record.project = project;
  record.organization = get('organization');
  record.agency = get('agency');
  record.island = island;
  record.moku = get('moku');
  record.programArea = programArea;
  record.act96Alignment = act96;
  record.status = status;
  record.publicationStatus = 'draft'; // intake proposes; a human publishes
  record.award = { fiscalYear: ctx.cohort, amountUsd: amount };
  record.summary = summary;
  record.location = { tmk, geoContext };
  record.outcomes = [];
  record.links = { dashboardId: null, storyMapId: null, webMapId: null };
  // Until a State program record is linked, provenance names the intake
  // source itself — the chain must never have an empty link.
  record.provenance = {
    programRecord: get('programRecord') || `${ctx.source} ${at} (intake source)`,
    authoritativeSource: get('authoritativeSource') || `${ctx.source} (sample intake source; link the State program record before publication)`,
  };
  return record;
}

// House-style serializer: the registry file is hand-formatted (inline award,
// inline TMK arrays, expanded provenance) so its diffs read record-by-record.
// Intake appends in the same style — a merge must never reformat the records
// a human already reviewed.
function serializeRecord(r) {
  const s = JSON.stringify;
  return [
    '    {',
    `      "id": ${s(r.id)},`,
    `      "slug": ${s(r.slug)},`,
    '      "sample": true,',
    `      "project": ${s(r.project)},`,
    `      "organization": ${s(r.organization)},`,
    `      "agency": ${s(r.agency)},`,
    `      "island": ${s(r.island)},`,
    `      "moku": ${s(r.moku)},`,
    `      "programArea": ${s(r.programArea)},`,
    `      "act96Alignment": ${s(r.act96Alignment)},`,
    `      "status": ${s(r.status)},`,
    `      "publicationStatus": ${s(r.publicationStatus)},`,
    `      "award": { "fiscalYear": ${s(r.award.fiscalYear)}, "amountUsd": ${r.award.amountUsd} },`,
    `      "summary": ${s(r.summary)},`,
    '      "location": {',
    `        "tmk": ${r.location.tmk === null ? 'null' : `[${r.location.tmk.map((t) => s(t)).join(', ')}]`},`,
    `        "geoContext": ${s(r.location.geoContext)}`,
    '      },',
    '      "outcomes": [],',
    '      "links": { "dashboardId": null, "storyMapId": null, "webMapId": null },',
    '      "provenance": {',
    `        "programRecord": ${s(r.provenance.programRecord)},`,
    `        "authoritativeSource": ${s(r.provenance.authoritativeSource)}`,
    '      }',
    '    }',
  ].join('\n');
}

// --- run ---------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const write = flags.has('--write');
const asJson = flags.has('--json');
const cohortFlag = /^--cohort=(FY\d{4})$/.exec(argv.find((a) => a.startsWith('--cohort=')) ?? '')?.[1]
  ?? (argv[argv.indexOf('--cohort') + 1] && argv.includes('--cohort') ? argv[argv.indexOf('--cohort') + 1] : null);
const sourcePath = argv.find((a) => !a.startsWith('--') && a !== cohortFlag);
const out = asJson ? console.error : console.log;

if (!sourcePath) {
  console.error('usage: node scripts/intake.mjs <source.xlsx|source.csv> [--write] [--json] [--cohort FY2026]');
  process.exit(1);
}

const findings = [];
const warnings = [];
const source = basename(sourcePath);
let rows;
try {
  rows = /\.xlsx$/i.test(sourcePath)
    ? parseXlsx(readFileSync(sourcePath))
    : /\.csv$/i.test(sourcePath)
      ? parseCsv(readFileSync(sourcePath, 'utf8'))
      : (() => { throw new Error('unsupported source type — intake parses .xlsx and .csv (legacy .xls and PDF walk the assisted-extraction path, docs/INTAKE.md)'); })();
} catch (e) {
  console.error(`INTAKE  ${source}: ${e.message}`);
  process.exit(1);
}

if (rows.length < 2) findings.push('source has no data rows under the header row');
const fields = rows.length ? mapHeaders(rows[0], findings, warnings) : [];
for (const w of warnings) out(`NOTE    ${source}: ${w}`);

// Cohort: --cohort flag, else FYxxxx in the source filename, else the file's
// own Fiscal Year column (first data row).
const fyColumn = fields.indexOf('fiscalYear');
const cohort =
  cohortFlag ??
  /FY\d{4}/.exec(source)?.[0] ??
  (fyColumn >= 0 && rows[1] ? `FY${/(\d{4})$/.exec(String(rows[1][fyColumn]).trim())?.[1] ?? ''}` : null);
if (!cohort || !/^FY\d{4}$/.test(cohort)) {
  findings.push('cannot determine cohort — pass --cohort FYxxxx, or put FYxxxx in the filename or a Fiscal Year column');
}

if (findings.length) {
  for (const f of findings) console.error(`INTAKE  ${source}: ${f}`);
  console.error(`\n${findings.length} finding(s) — intake rejected, nothing written.`);
  process.exit(1);
}

const year = cohort.slice(2);
const cohortPath = join(root, 'registry', `${cohort}.json`);
const cohortDoc = existsSync(cohortPath)
  ? JSON.parse(readFileSync(cohortPath, 'utf8'))
  : {
      cohort,
      sample: true,
      updated: new Date().toISOString().slice(0, 10),
      note: `Cohort file created by intake from ${source}. Every record is a sample (v0 schema guard); intake emits drafts only — a human publishes, never an automated process.`,
      records: [],
    };

const existingSlugs = new Set(cohortDoc.records.map((r) => r.slug));
const ctx = { cohort, year, source, idCounter: nextIdNumber(cohortDoc.records, year) };
const added = [], skipped = [];

for (let i = 1; i < rows.length; i++) {
  const raw = {};
  rows[i].forEach((v, c) => { if (fields[c]) raw[fields[c]] = v; });
  const at = `row ${i + 1}`;
  const slug = slugify((raw.project ?? '').toString().trim());
  if (slug && existingSlugs.has(slug)) {
    // Identity is immutable: intake never updates an existing record. Edits
    // to a known project happen in the registry file, in a reviewed diff.
    skipped.push(`${at}: "${slug}" already in ${cohort}.json — intake never overwrites`);
    continue;
  }
  const before = findings.length;
  const record = toRecord(raw, ctx, at, findings);
  if (findings.length === before && record) {
    added.push(record);
    existingSlugs.add(record.slug);
  } else {
    ctx.idCounter = nextIdNumber([...cohortDoc.records, ...added], year); // don't burn ids on rejected rows
  }
}

if (findings.length) {
  for (const f of findings) console.error(`INTAKE  ${source}: ${f}`);
  console.error(`\n${findings.length} finding(s) — intake rejected, nothing written.`);
  process.exit(1);
}

out(`intake: ${source} → ${cohort} — ${added.length} draft record(s), ${skipped.length} skipped`);
for (const s of skipped) out(`  skip  ${s}`);
for (const r of added) out(`  draft ${r.id}  ${r.slug}  $${r.award.amountUsd.toLocaleString('en-US')}`);

if (asJson) console.log(JSON.stringify(added, null, 2));

if (write && added.length) {
  const today = new Date().toISOString().slice(0, 10);
  const serialized = added.map(serializeRecord).join(',\n');
  let text;
  if (existsSync(cohortPath)) {
    text = readFileSync(cohortPath, 'utf8')
      .replace(/^(\s*"updated":\s*)"[0-9-]+"/m, `$1"${today}"`);
    const close = text.lastIndexOf('\n  ]\n}');
    if (close < 0) {
      console.error(`INTAKE  registry/${cohort}.json: cannot find the records array close — file not in registry house format, nothing written`);
      process.exit(1);
    }
    text = `${text.slice(0, close)},\n${serialized}${text.slice(close)}`;
  } else {
    text = [
      '{',
      `  "cohort": ${JSON.stringify(cohort)},`,
      '  "sample": true,',
      `  "updated": "${today}",`,
      `  "note": ${JSON.stringify(cohortDoc.note)},`,
      '  "records": [',
      serialized,
      '  ]',
      '}',
      '',
    ].join('\n');
  }
  writeFileSync(cohortPath, text);
  out(`wrote registry/${cohort}.json — run \`npm run validate\` (CI will, either way)`);
} else if (!write) {
  out('dry run — pass --write to merge into the registry');
}
