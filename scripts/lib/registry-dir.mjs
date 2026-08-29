/**
 * Where the registry lives — shared by validate, build, and intake.
 *
 * Default: <repo>/registry. Override with `--registry <dir>` (or
 * `--registry=<dir>`) or the KULEANA_REGISTRY_DIR environment variable, so
 * the same gates run unchanged against a cohort kept outside the public
 * repository (a private working set, a CI fixture, a State-owned copy).
 * Nothing about the rules changes with the directory — only where they look.
 */
import { resolve } from 'node:path';

export function resolveRegistryDir(root, argv = process.argv.slice(2)) {
  let dir = process.env.KULEANA_REGISTRY_DIR || null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--registry=')) dir = a.slice('--registry='.length);
    else if (a === '--registry' && argv[i + 1]) dir = argv[i + 1];
  }
  return dir ? resolve(root, dir) : resolve(root, 'registry');
}

/** Strip the registry flag (and its value) so callers can parse the rest. */
export function withoutRegistryArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--registry=')) continue;
    if (argv[i] === '--registry') { i++; continue; }
    out.push(argv[i]);
  }
  return out;
}
