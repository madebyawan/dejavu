import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { localLinks } from '../src/check.mjs';
import { run, tempRepo } from './helpers.mjs';

describe('check', () => {
  test('fails with guidance when .dejavu/ is missing', () => {
    const { code, stderr } = run('check', tempRepo());
    assert.equal(code, 1);
    assert.match(stderr, /\.dejavu\/ not found\. Run `dejavu init`/);
  });

  test('passes on a fresh minimal scaffold', () => {
    const dir = tempRepo();
    run('init', dir);
    const { code, stdout, stderr } = run('check', dir);
    assert.equal(code, 0, stderr);
    assert.match(stdout, /dejavu check passed: \d+ file\(s\) checked, 0 warning\(s\)/);
  });

  test('reports missing required paths', () => {
    const dir = tempRepo();
    run('init', dir);
    fs.rmSync(path.join(dir, '.dejavu/epistemology.md'));
    fs.rmSync(path.join(dir, '.dejavu/wisdom'), { recursive: true });
    const { code, stderr } = run('check', dir);
    assert.equal(code, 1);
    assert.match(stderr, /missing file \.dejavu\/epistemology\.md/);
    assert.match(stderr, /missing directory \.dejavu\/wisdom/);
    // Links to the removed paths are reported too.
    assert.match(stderr, /broken link to epistemology\.md/);
    assert.match(stderr, /dejavu check failed: 5 error\(s\)/);
  });

  test('reports broken local links with file and line', () => {
    const dir = tempRepo();
    run('init', dir);
    fs.appendFileSync(path.join(dir, '.dejavu/ontology.md'), '| Widget | x | [src](../src/widget.js) |\n');
    fs.writeFileSync(path.join(dir, '.dejavu/proposals/P-0001-x.md'), '# P\n\nSee [gone](../../docs/gone.md#part).\n');
    const { code, stderr } = run('check', dir);
    assert.equal(code, 1);
    assert.match(stderr, /\.dejavu\/ontology\.md:7: broken link to \.\.\/src\/widget\.js/);
    assert.match(stderr, /\.dejavu\/proposals\/P-0001-x\.md:3: broken link to \.\.\/\.\.\/docs\/gone\.md/);
  });

  test('detects stale index entries after a doc moves', () => {
    const dir = tempRepo({ 'docs/old.md': '# Old\n' });
    run('init', dir, '--mode', 'adopt-existing');
    fs.renameSync(path.join(dir, 'docs/old.md'), path.join(dir, 'docs/new.md'));
    const { code, stderr } = run('check', dir);
    assert.equal(code, 1);
    assert.match(stderr, /\.dejavu\/index\.md:\d+: broken link to \.\.\/docs\/old\.md/);
  });

  test('warns, without failing, when AGENTS.md is missing or does not point to .dejavu/', () => {
    const dir = tempRepo();
    run('init', dir, '--no-agents');
    let result = run('check', dir);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /warning: AGENTS\.md not found/);

    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\n');
    result = run('check', dir);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /warning: AGENTS\.md does not mention \.dejavu/);
  });

  test('validates installed skill frontmatter', () => {
    const dir = tempRepo({ '.claude/skills/dejavu/SKILL.md': '# No frontmatter\n' });
    run('init', dir);
    const { code, stderr } = run('check', dir);
    assert.equal(code, 1);
    assert.match(stderr, /\.claude\/skills\/dejavu\/SKILL\.md: SKILL\.md needs YAML frontmatter/);
  });
});

describe('localLinks', () => {
  test('ignores external links, anchors, and code', () => {
    const text = [
      '[a](https://example.com) [b](#top) [c](mailto:x@y.z)',
      '`[d](inline.md)`',
      '```',
      '[e](fenced.md)',
      '```',
      '[f](real.md "Title") ![g](<img dir/pic.png>) [h](sp%20ace.md#x)',
    ].join('\n');
    assert.deepEqual([...localLinks(text)], [
      { line: 6, target: 'real.md' },
      { line: 6, target: 'img dir/pic.png' },
      { line: 6, target: 'sp ace.md' },
    ]);
  });
});
