#!/usr/bin/env node
/**
 * Rewrite every reference to the site's domain.
 *
 *   npm run set-domain -- yourdomain.com
 *
 * The domain appears in canonical/OG/JSON-LD metadata, the sitemap, robots.txt,
 * the mailto: addresses and the docs. This keeps them in step rather than
 * relying on a careful find-and-replace at 2am.
 *
 * Pass --dry-run to see what would change without writing anything.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'public/index.html',
  'public/privacy.html',
  'public/terms.html',
  'public/app.js',
  'public/robots.txt',
  'public/sitemap.xml',
  'README.md',
  'DEPLOY.md',
  '.dev.vars.example',
];

/** The domain currently baked into the files. Updated in place on each run. */
const CURRENT_FILE = join(ROOT, '.current-domain');
const DEFAULT_DOMAIN = 'myhealthscanner.com';

// A hostname: labels of letters/digits/hyphens, at least one dot, no scheme or path.
const VALID = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const next = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

if (!next) {
  console.error('Usage: npm run set-domain -- yourdomain.com [--dry-run]');
  process.exit(1);
}
if (!VALID.test(next)) {
  console.error(`Not a bare domain: "${next}"`);
  console.error('Give the hostname only — no https://, no www., no trailing path.');
  process.exit(1);
}

let current = DEFAULT_DOMAIN;
try {
  current = readFileSync(CURRENT_FILE, 'utf8').trim() || DEFAULT_DOMAIN;
} catch { /* first run: fall back to the default */ }

if (current === next) {
  console.log(`Already set to ${next}. Nothing to do.`);
  process.exit(0);
}

const pattern = new RegExp(current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

let total = 0;
const changed = [];

for (const relative of FILES) {
  const path = join(ROOT, relative);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    console.warn(`  skipped (not found): ${relative}`);
    continue;
  }

  const hits = (text.match(pattern) || []).length;
  if (!hits) continue;

  total += hits;
  changed.push(`  ${String(hits).padStart(3)} × ${relative}`);
  if (!dryRun) writeFileSync(path, text.replace(pattern, next));
}

console.log(`${dryRun ? 'Would replace' : 'Replaced'} ${current} → ${next}`);
console.log(changed.join('\n') || '  (no references found)');
console.log(`  ${total} total`);

if (dryRun) process.exit(0);

writeFileSync(CURRENT_FILE, `${next}\n`);

// The JSON-LD block carries the domain, so its CSP hash just went stale.
// Refresh it here rather than leaving it as a step someone forgets.
execFileSync(process.execPath, [join(ROOT, 'scripts/csp-hash.mjs')], { stdio: 'inherit' });

console.log(`
Next:
  1. Redeploy:  npm run deploy
  2. Add ${next} and www.${next} as custom domains in the Pages project.`);
