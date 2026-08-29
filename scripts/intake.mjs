#!/usr/bin/env node
/**
 * Intake transform — gate 0 of the pipeline
 * (SOURCE INTAKE → registry update → validation → manifest build → site
 * build → publication).
 *
 * Turns a structured source file — .xlsx or .csv, the shapes award data
 * actually arrives in — into draft registry records. The transform is
 * deliberately dumb about trust: everything it emits is `publicationStatus:
 * "draft"`, and it never touches a record that already exists. Intake
 * proposes; the validation gate judges; a human publishes.
 *
 * Two registry shapes (see scripts/validate.mjs):
 *   - v0 (demonstration): every emitted record is stamped `sample: true`,
 *     the schema guard that keeps real data out of the demo.
 *   - v1.0 (program data): minimal at draft — an appropriation worksheet
 *     row (department, program ID, project, amount) is enough to enter the
 *     registry; geography, program area, alignment, summary, and the
 *     project-lead contact are earned before publication. Chosen by the
 *     target cohort file's `schemaVersion`, or `--v1` when creating one.
 *
 * Dependency-free on purpose, like the validator: the .xlsx reader walks the
 * ZIP container and sheet XML with node built-ins only. Legacy binary .xls
 * and PDF sources walk the assisted-extraction path (docs/INTAKE.md) into
 * this same column contract as CSV.
 *
 * Usage:
 *   node scripts/intake.mjs <source.xlsx|source.csv> [--write] [--json]
 *        [--cohort FY2027] [--v1] [--sample] [--fiscal-public]
 *        [--source "<cohort provenance note>"] [--registry <dir>]
 *
 * Default is a dry run. --write merges into <registry>/FY<year>.json.
 * --json prints the generated records as JSON on stdout (report to stderr).
 * --v1 creates a new cohort in the v1.0 shape (ignored if the cohort file
 * already exists — its own schemaVersion wins). --sample marks a new v1
 * cohort as demonstration data. --fiscal-public marks a new v1 cohort's
 * appropriation figures as public (enacted budget).
 *
 * Exit code 0 = transform clean (skips allowed); 1 = findings.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { resolveRegistryDir, withoutRegistryArgs } from './lib/registry-dir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMAS = {
  v0: JSON.parse(readFileSync(join(root, 'schemas', 'registry.schema.json'), 'utf8')),
  v1: JSON.parse(readFileSync(join(root, 'schemas', 'registry.v1.schema.json'), 'utf8')),
};

// Enums come from the schemas, never restated here.
function enumsFor(mode) {
  const p = SCHEMAS[mode].$defs.record.properties;
  return {
    island: p.island.enum,
    programArea: p.programArea.enum ?? null, // v1: open slug, no enum
    act96Alignment: p.act96Alignment.enum,
    status: p.status.enum,
    fundingStatus: p.funding?.properties.status.enum ?? null,
  };
}

// --- text normalization ------------------------------------------------------

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036fʻ‘’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    entries.set(name, { method, raw: buf.subarray(dataStart, dataStart + compSize) });
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
  const sheetXml = entry('xl/worksheets/sheet1.xml');
  if (sheetXml == null) throw new Error('no xl/worksheets/sheet1.xml in workbook');
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
// Headers are matched loosely (case, spacing, punctuation ignored). Canonical
// contract in docs/INTAKE.md; aliases cover the shapes a program office —
// or a legislative budget worksheet — is likely to send.

const HEADER_MAP = {
  project: ['project', 'projectname', 'projecttitle', 'title', 'detailoflegislativeadjustment'],
  organization: ['organization', 'awardee', 'organizationawardee', 'grantee'],
  agency: ['agency', 'administeringagency', 'departmentname'],
  departmentCode: ['dept', 'department', 'departmentcode', 'deptcode'],
  programId: ['programid', 'programcode', 'progid', 'program'],
  island: ['island'],
  moku: ['moku'],
  programArea: ['programarea', 'area'],
  act96Alignment: ['act96alignment', 'act96purpose', 'act96category', 'alignment'],
  status: ['status', 'projectstatus'],
  fiscalYear: ['fiscalyear', 'fy'],
  amountUsd: ['awardamount', 'amount', 'amountusd', 'award', 'appropriation', 'fy27', 'fy27amount'],
  meansOfFinancing: ['meansoffinancing', 'mof', 'fund', 'fundsource', 'fundingsource'],
  nonRecurring: ['nonrecurring', 'onetime'],
  legislativeReference: ['legislativereference', 'legref', 'reference', 'act', 'worksheetrow'],
  fundingStatus: ['fundingstatus', 'releasestatus', 'fundstatus'],
  releasedUsd: ['released', 'releasedamount', 'amountreleased', 'allotted', 'allotment'],
  expendedUsd: ['expended', 'expendedamount', 'spent', 'expenditures'],
  fundingAsOf: ['asof', 'asofdate', 'fundingasof'],
  summary: ['summary', 'description', 'projectdescription'],
  tmk: ['tmk', 'tmks', 'taxmapkey', 'taxmapkeys'],
  geoContext: ['geocontext', 'locationnote', 'geographiccontext', 'footprint', 'location'],
  contactName: ['contactname', 'projectlead', 'projectleadname', 'lead', 'leadname'],
  contactEmail: ['contactemail', 'email', 'leademail', 'projectleademail'],
  programRecord: ['programrecord'],
  authoritativeSource: ['authoritativesource', 'source', 'sourcerecord'],
};

const V1_ONLY = new Set(['departmentCode', 'programId', 'meansOfFinancing', 'nonRecurring', 'legislativeReference',
  'fundingStatus', 'releasedUsd', 'expendedUsd', 'fundingAsOf', 'contactName', 'contactEmail']);

const REQUIRED = {
  v0: ['project', 'organization', 'agency', 'island', 'moku', 'programArea', 'act96Alignment', 'amountUsd', 'summary'],
  v1: ['project', 'amountUsd'], // + agency OR departmentCode, checked below
};

function mapHeaders(headerRow, mode, findings, warnings) {
  const fields = new Array(headerRow.length).fill(null);
  const seen = new Set();
  headerRow.forEach((h, i) => {
    const key = slugify(String(h)).replace(/-/g, '');
    if (!key) return;
    const field = Object.keys(HEADER_MAP).find((f) => HEADER_MAP[f].includes(key));
    if (!field) {
      warnings.push(`header "${h}": no matching registry field — column ignored (see docs/INTAKE.md for the contract)`);
      return;
    }
    if (mode === 'v0' && V1_ONLY.has(field)) {
      warnings.push(`header "${h}": "${field}" is a v1 field — ignored for a v0 (demonstration) registry`);
      return;
    }
    if (seen.has(field)) findings.push(`header "${h}": duplicate mapping for "${field}"`);
    seen.add(field);
    fields[i] = field;
  });
  for (const required of REQUIRED[mode]) {
    if (!seen.has(required)) findings.push(`source is missing a column for required field "${required}"`);
  }
  if (mode === 'v1' && !seen.has('agency') && !seen.has('departmentCode')) {
    findings.push('source is missing an agency or department column (v1 needs one to name the administering agency)');
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

const money = (s) => Number(String(s).replace(/[$,\s]/g, ''));
const truthy = (s) => /^(y|yes|true|x|1|non-?recurring)$/i.test(String(s).trim());

function toRecord(raw, ctx, at, findings) {
  const { mode, enums } = ctx;
  const get = (f) => (raw[f] ?? '').toString().trim();
  const fail = (msg) => { findings.push(`${at}: ${msg}`); };
  const r = {};

  const project = get('project');
  if (!project) return fail('no project name — row skipped');

  // --- fields shared by both shapes (v0 requires them; v1 accepts them) ---
  const islandRaw = get('island');
  const island = islandRaw ? matchEnum(islandRaw, enums.island) : null;
  if (islandRaw && !island) fail(`island "${islandRaw}" not one of [${enums.island.join(', ')}]`);

  const areaRaw = get('programArea');
  let programArea = null;
  if (areaRaw) {
    programArea = enums.programArea ? matchEnum(areaRaw, enums.programArea) : slugify(areaRaw);
    if (!programArea) fail(`program area "${areaRaw}" not one of [${enums.programArea.join(', ')}]`);
  }

  const actRaw = get('act96Alignment');
  const act96 = actRaw ? matchEnum(actRaw, enums.act96Alignment) : null;
  if (actRaw && !act96) fail(`Act 96 alignment "${actRaw}" not one of [${enums.act96Alignment.join(', ')}]`);

  const statusRaw = get('status');
  const status = statusRaw ? matchEnum(statusRaw, enums.status) : (mode === 'v1' ? 'planned' : 'active');
  if (!status) fail(`status "${statusRaw}" not one of [${enums.status.join(', ')}]`);

  const amount = money(get('amountUsd'));
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
  const hasLocation = tmk !== null || geoContext !== null;
  if (mode === 'v0' && tmk === null && !geoContext) fail('no TMK and no geo context — a non-parcel footprint must be named');
  if (mode === 'v1' && hasLocation && tmk === null && !geoContext) fail('TMK column empty without a geo context — a non-parcel footprint must be named');

  const summary = get('summary');
  if (mode === 'v0' && summary.length < 20) fail('summary is missing or shorter than 20 characters');
  if (mode === 'v1' && summary && summary.length < 20) fail('summary present but shorter than 20 characters');

  // --- assemble, in house order ---
  r.id = `GF-${ctx.year}-HI-${String(++ctx.idCounter).padStart(3, '0')}`;
  r.slug = slugify(project);
  if (mode === 'v0' || ctx.sample) r.sample = true;
  r.project = project;
  if (mode === 'v0' || get('organization')) r.organization = get('organization');
  r.agency = get('agency') || get('departmentCode');
  if (mode === 'v1') {
    const dept = get('departmentCode').toUpperCase();
    if (dept) { if (/^[A-Z]{3}$/.test(dept)) r.departmentCode = dept; else fail(`department code "${dept}" is not three letters`); }
    const pid = get('programId').toUpperCase().replace(/\s+/g, '');
    if (pid) { if (/^[A-Z]{3}[0-9]{3}(\/[A-Z]{2})?$/.test(pid)) r.programId = pid; else fail(`program ID "${pid}" is not like LNR407 or BED170/KB`); }
  }
  if (mode === 'v0' || island) r.island = island;
  if (mode === 'v0' || get('moku')) r.moku = get('moku');
  if (mode === 'v0' || programArea) r.programArea = programArea;
  if (mode === 'v0' || act96) r.act96Alignment = act96;
  r.status = status;
  r.publicationStatus = 'draft'; // intake proposes; a human publishes
  r.award = { fiscalYear: ctx.cohort, amountUsd: amount };
  if (mode === 'v1') {
    if (get('meansOfFinancing')) r.award.meansOfFinancing = get('meansOfFinancing');
    if (get('nonRecurring')) r.award.nonRecurring = truthy(get('nonRecurring'));
    if (get('legislativeReference')) r.award.legislativeReference = get('legislativeReference');
    const fsRaw = get('fundingStatus');
    if (fsRaw || get('releasedUsd') || get('expendedUsd')) {
      const fs = fsRaw ? matchEnum(fsRaw, enums.fundingStatus) : 'appropriated';
      if (!fs) fail(`funding status "${fsRaw}" not one of [${enums.fundingStatus.join(', ')}]`);
      r.funding = { status: fs ?? 'appropriated' };
      if (get('releasedUsd')) r.funding.releasedUsd = money(get('releasedUsd'));
      if (get('expendedUsd')) r.funding.expendedUsd = money(get('expendedUsd'));
      if (get('fundingAsOf')) r.funding.asOf = get('fundingAsOf');
    }
  }
  if (mode === 'v0' || summary) r.summary = summary;
  if (mode === 'v0' || hasLocation) r.location = { tmk, geoContext };
  r.outcomes = [];
  r.links = { dashboardId: null, storyMapId: null, webMapId: null };
  r.provenance = {
    programRecord: get('programRecord') || `${ctx.source} ${at} (intake source)`,
    authoritativeSource: get('authoritativeSource') || `${ctx.source} (intake source; link the State program record before publication)`,
  };
  if (mode === 'v1' && (get('contactName') || get('contactEmail'))) {
    if (!get('contactName') || !get('contactEmail')) fail('contact needs both a name and an email');
    else r.contact = { name: get('contactName'), email: get('contactEmail') };
  }
  return r;
}

// --- house-style serializer -------------------------------------------------
// The registry file is hand-formatted (inline award, inline TMK arrays,
// expanded provenance) so diffs read record-by-record. Intake appends in the
// same style and never reformats records a human already reviewed.

function serializeRecord(r) {
  const s = JSON.stringify;
  const L = ['    {'];
  const line = (k, v) => L.push(`      ${s(k)}: ${v},`);
  const inlineObj = (o) => `{ ${Object.entries(o).map(([k, v]) => `${s(k)}: ${s(v)}`).join(', ')} }`;
  line('id', s(r.id));
  line('slug', s(r.slug));
  if (r.sample) line('sample', 'true');
  line('project', s(r.project));
  if (r.organization != null) line('organization', s(r.organization));
  line('agency', s(r.agency));
  if (r.departmentCode) line('departmentCode', s(r.departmentCode));
  if (r.programId) line('programId', s(r.programId));
  if (r.island != null) line('island', s(r.island));
  if (r.moku != null) line('moku', s(r.moku));
  if (r.programArea != null) line('programArea', s(r.programArea));
  if (r.act96Alignment != null) line('act96Alignment', s(r.act96Alignment));
  line('status', s(r.status));
  line('publicationStatus', s(r.publicationStatus));
  line('award', inlineObj(r.award));
  if (r.funding) line('funding', inlineObj(r.funding));
  if (r.summary != null) line('summary', s(r.summary));
  if (r.location) {
    L.push('      "location": {');
    L.push(`        "tmk": ${r.location.tmk === null ? 'null' : `[${r.location.tmk.map((t) => s(t)).join(', ')}]`},`);
    L.push(`        "geoContext": ${s(r.location.geoContext)}`);
    L.push('      },');
  }
  line('outcomes', '[]');
  line('links', '{ "dashboardId": null, "storyMapId": null, "webMapId": null }');
  L.push('      "provenance": {');
  L.push(`        "programRecord": ${s(r.provenance.programRecord)},`);
  L.push(`        "authoritativeSource": ${s(r.provenance.authoritativeSource)}`);
  L.push(r.contact ? '      },' : '      }');
  if (r.contact) L.push(`      "contact": ${inlineObj(r.contact)}`);
  L.push('    }');
  return L.join('\n');
}

// --- run ---------------------------------------------------------------------

const registryDir = resolveRegistryDir(root);
const argv = withoutRegistryArgs(process.argv.slice(2));
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const valueOf = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const write = flags.has('--write');
const asJson = flags.has('--json');
const cohortFlag = valueOf('--cohort');
const sourceFlag = valueOf('--source');
const consumed = new Set([cohortFlag, sourceFlag].filter(Boolean));
const sourcePath = argv.find((a) => !a.startsWith('--') && !consumed.has(a));
const out = asJson ? console.error : console.log;

if (!sourcePath) {
  console.error('usage: node scripts/intake.mjs <source.xlsx|source.csv> [--write] [--json] [--cohort FY2027] [--v1] [--sample] [--fiscal-public] [--source "note"] [--registry <dir>]');
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

// Cohort: --cohort flag, else FYxxxx in the filename, else the Fiscal Year column.
const headerKeys = rows.length ? rows[0].map((h) => slugify(String(h)).replace(/-/g, '')) : [];
const fyColumn = headerKeys.findIndex((k) => HEADER_MAP.fiscalYear.includes(k));
const cohort =
  cohortFlag ??
  /FY\d{4}/.exec(source)?.[0] ??
  (fyColumn >= 0 && rows[1] ? `FY${/(\d{4})$/.exec(String(rows[1][fyColumn]).trim())?.[1] ?? ''}` : null);
if (!cohort || !/^FY\d{4}$/.test(cohort)) {
  findings.push('cannot determine cohort — pass --cohort FYxxxx, or put FYxxxx in the filename or a Fiscal Year column');
}

// Registry shape: an existing cohort file decides; a new one follows --v1.
const cohortPath = cohort ? join(registryDir, `${cohort}.json`) : null;
const existing = cohortPath && existsSync(cohortPath) ? JSON.parse(readFileSync(cohortPath, 'utf8')) : null;
const mode = existing ? (existing.schemaVersion ? 'v1' : 'v0') : (flags.has('--v1') ? 'v1' : 'v0');
if (existing && flags.has('--v1') && mode === 'v0') warnings.push(`${cohort}.json is a v0 (demonstration) cohort — --v1 ignored; its own shape wins`);
if (existing && existing.schemaVersion && existing.schemaVersion !== '1.0') findings.push(`${cohort}.json has unknown schemaVersion ${JSON.stringify(existing.schemaVersion)}`);

const fields = rows.length ? mapHeaders(rows[0], mode, findings, warnings) : [];
for (const w of warnings) out(`NOTE    ${source}: ${w}`);

if (findings.length) {
  for (const f of findings) console.error(`INTAKE  ${source}: ${f}`);
  console.error(`\n${findings.length} finding(s) — intake rejected, nothing written.`);
  process.exit(1);
}

const year = cohort.slice(2);
const cohortDoc = existing ?? {
  ...(mode === 'v1' ? { schemaVersion: '1.0' } : {}),
  cohort,
  ...(mode === 'v0' || flags.has('--sample') ? { sample: true } : {}),
  updated: new Date().toISOString().slice(0, 10),
  ...(mode === 'v1' ? { source: sourceFlag ?? `Intake from ${source}` } : {}),
  ...(mode === 'v1' && flags.has('--fiscal-public') ? { fiscalPublic: true } : {}),
  note: mode === 'v1'
    ? `Cohort file created by intake from ${source}. Records enter minimal (appropriation shape) and earn geography, program area, alignment, summary, story, outcomes, and a project-lead contact before the publication gate releases them. Intake emits drafts only — a human publishes, never an automated process.`
    : `Cohort file created by intake from ${source}. Every record is a sample (v0 schema guard); intake emits drafts only — a human publishes, never an automated process.`,
  records: [],
};

const existingSlugs = new Set(cohortDoc.records.map((r) => r.slug));
const ctx = {
  mode, enums: enumsFor(mode), cohort, year, source,
  sample: mode === 'v1' && (cohortDoc.sample === true || flags.has('--sample')),
  idCounter: nextIdNumber(cohortDoc.records, year),
};
const added = [], skipped = [];

for (let i = 1; i < rows.length; i++) {
  const raw = {};
  rows[i].forEach((v, c) => { if (fields[c]) raw[fields[c]] = v; });
  const at = `row ${i + 1}`;
  const slug = slugify((raw.project ?? '').toString().trim());
  if (slug && existingSlugs.has(slug)) {
    // Identity is immutable: intake never updates an existing record.
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

out(`intake: ${source} → ${cohort} (${mode === 'v1' ? 'v1.0' : 'v0'}) — ${added.length} draft record(s), ${skipped.length} skipped`);
for (const s of skipped) out(`  skip  ${s}`);
for (const r of added) out(`  draft ${r.id}  ${r.slug}  $${r.award.amountUsd.toLocaleString('en-US')}`);

if (asJson) console.log(JSON.stringify(added, null, 2));

if (write && added.length) {
  const today = new Date().toISOString().slice(0, 10);
  const serialized = added.map(serializeRecord).join(',\n');
  let text;
  if (existing) {
    text = readFileSync(cohortPath, 'utf8')
      .replace(/^(\s*"updated":\s*)"[0-9-]+"/m, `$1"${today}"`);
    const close = text.lastIndexOf('\n  ]\n}');
    if (close < 0) {
      console.error(`INTAKE  ${cohort}.json: cannot find the records array close — file not in registry house format, nothing written`);
      process.exit(1);
    }
    const emptyArray = /"records":\s*\[\s*\n\s*\]\s*\n}\s*$/.test(text);
    text = `${text.slice(0, close)}${emptyArray ? '\n' : ',\n'}${serialized}${text.slice(close)}`;
  } else {
    const head = Object.entries(cohortDoc)
      .filter(([k]) => k !== 'records')
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    text = ['{', ...head, '  "records": [', serialized, '  ]', '}', ''].join('\n');
  }
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(cohortPath, text);
  out(`wrote ${cohortPath} — run \`npm run validate\`${registryDir === join(root, 'registry') ? '' : ` -- --registry ${registryDir}`} (CI will, either way)`);
} else if (!write) {
  out('dry run — pass --write to merge into the registry');
}
