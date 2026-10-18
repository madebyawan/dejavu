import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { releaseNotes } from '../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

- Pending.

## [0.2.0] - 2026-11-01

### Added

- Orient.

## [0.1.0] - 2026-10-19

- First release.
`;

test('extracts one version section', () => {
  assert.equal(releaseNotes(CHANGELOG, 'v0.2.0'), '### Added\n\n- Orient.');
  assert.equal(releaseNotes(CHANGELOG, '0.1.0'), '- First release.');
  assert.equal(releaseNotes(CHANGELOG, '0.3.0'), null);
});

test('package version is valid semver and the changelog has an Unreleased section', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'dejavu-memory');
  assert.deepEqual(Object.keys(pkg.bin), ['dejavu']);
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  assert.equal(pkg.private, true, 'stay private until a package name and release are approved');
  const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.ok(releaseNotes(changelog, 'Unreleased'));
});
