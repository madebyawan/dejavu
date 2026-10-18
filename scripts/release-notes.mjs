#!/usr/bin/env node
// Print the CHANGELOG.md section for a version, for use as GitHub release notes.
// Usage: node scripts/release-notes.mjs <version> [changelog]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function releaseNotes(changelog, version) {
  const v = version.replace(/^v/, '');
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\]`).test(l));
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, file = 'CHANGELOG.md'] = process.argv.slice(2);
  if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version> [changelog]');
    process.exit(2);
  }
  const notes = releaseNotes(fs.readFileSync(file, 'utf8'), version);
  if (!notes) {
    console.error(`No "## [${version.replace(/^v/, '')}]" section with content in ${file}.`);
    process.exit(1);
  }
  console.log(notes);
}
