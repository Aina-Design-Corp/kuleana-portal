#!/usr/bin/env node
/**
 * Registry validation — gate 1 of the pipeline
 * (registry update → VALIDATION → manifest build → site build → publication).
 *
 * Dependency-free on purpose: the validator interprets the JSON Schema
 * directly for the keyword subset the schema uses, so the schema stays the
 * single source of truth and the gate runs anywhere with zero install.
 *
 * Beyond the schema, enforces the registry invariants a schema can't express:
 *   - ids and slugs unique across the cohort
 *   - record id year matches the cohort fiscal year
 *   - a `published` record must carry a story, at least one outcome, and
 *     full provenance (the publication gate's release bar)
 *   - a record with no TMK (location.tmk: null) must name its non-parcel
 *     footprint in location.geoContext
 *
 * Exit code 0 = valid; 1 = findings (each printed with its path).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schemas', 'registry.schema.json'), 'utf8'));

// --- minimal JSON Schema interpreter (subset the schema uses) ---------------

function resolveRef(ref, rootSchema) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref: ${ref}`);
  let node = rootSchema;
  for (const part of ref.slice(2).split('/')) node = node[part];
  return node;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(declared, actual) {
  if (declared === actual) return true;
  return declared === 'number' && actual === 'integer';
}

function check(s, value, path, rootSchema, errs) {
  if (s.$ref) s = { ...resolveRef(s.$ref, rootSchema), ...s, $ref: undefined };

  if ('const' in s && value !== s.const) {
    errs.push(`${path}: must be ${JSON.stringify(s.const)} (got ${JSON.stringify(value)})`);
    return;
  }
  if (s.enum && !s.enum.includes(value)) {
    errs.push(`${path}: ${JSON.stringify(value)} not one of [${s.enum.join(', ')}]`);
    return;
  }
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    const actual = typeOf(value);
    if (!types.some((t) => typeMatches(t, actual))) {
      errs.push(`${path}: expected ${types.join('|')}, got ${actual}`);
      return;
    }
  }
  if (typeof value === 'string') {
    if (s.pattern && !new RegExp(s.pattern).test(value)) {
      errs.push(`${path}: "${value}" does not match ${s.pattern}`);
    }
    if (s.minLength != null && value.length < s.minLength) {
      errs.push(`${path}: shorter than minLength ${s.minLength}`);
    }
  }
  if (typeof value === 'number' && s.minimum != null && value < s.minimum) {
    errs.push(`${path}: ${value} below minimum ${s.minimum}`);
  }
  if (Array.isArray(value)) {
    if (s.minItems != null && value.length < s.minItems) {
      errs.push(`${path}: fewer than minItems ${s.minItems}`);
    }
    if (s.items) value.forEach((v, i) => check(s.items, v, `${path}[${i}]`, rootSchema, errs));
  }
  if (typeOf(value) === 'object') {
    for (const key of s.required || []) {
      if (!(key in value)) errs.push(`${path}: missing required "${key}"`);
    }
    for (const [key, v] of Object.entries(value)) {
      if (s.properties && key in s.properties) {
        check(s.properties[key], v, `${path}.${key}`, rootSchema, errs);
      } else if (s.additionalProperties === false) {
        errs.push(`${path}: unexpected property "${key}"`);
      }
    }
  }
}

// --- registry invariants beyond the schema ----------------------------------

function invariants(cohort, file, errs) {
  const ids = new Map(), slugs = new Map();
  const year = (cohort.cohort || '').replace(/^FY/, '');
  for (const [i, r] of (cohort.records || []).entries()) {
    const at = `${file}.records[${i}]`;
    if (ids.has(r.id)) errs.push(`${at}: duplicate id "${r.id}" (also records[${ids.get(r.id)}])`);
    ids.set(r.id, i);
    if (slugs.has(r.slug)) errs.push(`${at}: duplicate slug "${r.slug}" (also records[${slugs.get(r.slug)}])`);
    slugs.set(r.slug, i);
    if (r.id && !r.id.startsWith(`GF-${year}-`)) {
      errs.push(`${at}: id "${r.id}" does not match cohort ${cohort.cohort}`);
    }
    if (r.award?.fiscalYear && r.award.fiscalYear !== cohort.cohort) {
      errs.push(`${at}: award.fiscalYear ${r.award.fiscalYear} != cohort ${cohort.cohort}`);
    }
    if (r.location && r.location.tmk === null && !r.location.geoContext) {
      errs.push(`${at}: location.tmk is null without a geoContext note (a non-parcel footprint must be named)`);
    }
    if (r.publicationStatus === 'published') {
      if (!r.story) errs.push(`${at}: published without a story (release bar)`);
      if (!r.outcomes?.length) errs.push(`${at}: published without outcomes (release bar)`);
      if (!r.provenance?.programRecord) errs.push(`${at}: published without provenance (release bar)`);
    }
  }
}

// --- run ---------------------------------------------------------------------

const registryDir = join(root, 'registry');
const files = readdirSync(registryDir).filter((f) => /^FY\d{4}\.json$/.test(f));
if (!files.length) { console.error('no registry cohort files found'); process.exit(1); }

const errs = [];
for (const f of files) {
  let cohort;
  try {
    cohort = JSON.parse(readFileSync(join(registryDir, f), 'utf8'));
  } catch (e) {
    errs.push(`${f}: parse error — ${e.message}`);
    continue;
  }
  check(schema, cohort, f, schema, errs);
  invariants(cohort, f, errs);
}

if (errs.length) {
  for (const e of errs) console.error(`INVALID  ${e}`);
  console.error(`\n${errs.length} finding(s) — registry rejected, nothing builds.`);
  process.exit(1);
}
console.log(`valid: ${files.join(', ')} — schema + invariants clean`);
