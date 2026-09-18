#!/usr/bin/env node
/**
 * Recompute the Content-Security-Policy hash for the inline JSON-LD block.
 *
 *   npm run csp-hash
 *
 * script-src is 'self' plus one sha256 hash, so the structured-data block in
 * index.html is the only inline script the browser will run. Edit that block
 * and the hash stops matching — the JSON-LD is then silently blocked, which
 * costs you the rich search result and gives no visible error on the page.
 * Run this after any change to it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'public/index.html');
const HEADERS = join(ROOT, 'public/_headers');

const html = readFileSync(INDEX, 'utf8');

const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
if (blocks.length === 0) {
  console.error('No inline <script> found in public/index.html — nothing to hash.');
  process.exit(1);
}
if (blocks.length > 1) {
  console.error(`Found ${blocks.length} inline scripts; the CSP allows exactly one hash.`);
  console.error('Either inline only the JSON-LD block, or extend this script to emit several hashes.');
  process.exit(1);
}

const hash = `sha256-${createHash('sha256').update(blocks[0][1], 'utf8').digest('base64')}`;

const headers = readFileSync(HEADERS, 'utf8');
const SCRIPT_SRC = /script-src 'self'(?: '(sha256-[A-Za-z0-9+/=]+)')?/;

const found = headers.match(SCRIPT_SRC);
if (!found) {
  console.error("Couldn't find \"script-src 'self'\" in public/_headers.");
  process.exit(1);
}
if (found[1] === hash) {
  console.log(`CSP hash already current: ${hash}`);
  process.exit(0);
}

writeFileSync(HEADERS, headers.replace(SCRIPT_SRC, `script-src 'self' '${hash}'`));
console.log(`CSP hash updated${found[1] ? `\n  was: ${found[1]}` : ''}\n  now: ${hash}`);
