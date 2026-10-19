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

test('package is publishable and the changelog has notes for its version', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'dejavu-memory');
  assert.deepEqual(Object.keys(pkg.bin), ['dejavu']);
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  assert.notEqual(pkg.private, true, 'published to npm');
  assert.deepEqual(pkg.files, ['bin/', 'src/', 'skills/']);
  const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(changelog, /^## \[Unreleased\]$/m);
  assert.ok(releaseNotes(changelog, pkg.version), `CHANGELOG.md has notes for ${pkg.version}`);
});

test('the Claude Code plugin matches the package version and ships the skill', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'));
  const market = JSON.parse(fs.readFileSync(new URL('../.claude-plugin/marketplace.json', import.meta.url), 'utf8'));
  assert.equal(plugin.name, 'dejavu');
  assert.equal(plugin.version, pkg.version);
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source]), [['dejavu', './']]);
  assert.ok(fs.existsSync(new URL('../skills/dejavu/SKILL.md', import.meta.url)));
  assert.ok(fs.statSync(new URL('../bin/dejavu', import.meta.url)).mode & 0o111 || process.platform === 'win32', 'bin/dejavu is executable');
});
