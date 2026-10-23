import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { exists, read, run, snapshot, tempRepo } from './helpers.mjs';

const KNOWLEDGE = [
  '.dejavu/README.md', '.dejavu/index.md', '.dejavu/ontology.md', '.dejavu/topology.md',
  '.dejavu/epistemology.md', '.dejavu/wisdom/README.md', '.dejavu/proposals/README.md',
  '.dejavu/handoffs/README.md', '.dejavu/handoffs/.gitignore',
];

describe('init --mode minimal (default)', () => {
  test('creates .dejavu/ and thin agent pointers only', () => {
    const dir = tempRepo();
    const { code, stdout } = run('init', dir);
    assert.equal(code, 0);
    assert.match(stdout, /mode: minimal/);
    for (const rel of [...KNOWLEDGE, 'AGENTS.md', 'CLAUDE.md']) assert.ok(exists(dir, rel), rel);
    assert.ok(!exists(dir, 'docs'));
    assert.match(read(dir, 'CLAUDE.md'), /^@AGENTS\.md$/m);
    assert.match(read(dir, 'AGENTS.md'), /\.dejavu\/README\.md/);
    assert.match(read(dir, '.dejavu/index.md'), /Not indexed in minimal mode/);
  });

  test('running twice is safe and changes nothing', () => {
    const dir = tempRepo({ 'README.md': '# Sample\n' });
    run('init', dir);
    const before = snapshot(dir);
    const { code, stdout } = run('init', dir);
    assert.equal(code, 0);
    assert.deepEqual(snapshot(dir), before);
    assert.match(stdout, /Created 0 file\(s\); left 11 existing file\(s\) unchanged/);
    assert.doesNotMatch(stdout, /Note:/);
  });

  test('never replaces existing AGENTS.md or CLAUDE.md, and suggests a pointer', () => {
    const files = { 'AGENTS.md': '# Ours\nKeep me.\n', 'CLAUDE.md': '# Claude\nCustom.\n' };
    const dir = tempRepo(files);
    const { code, stdout } = run('init', dir);
    assert.equal(code, 0);
    assert.equal(read(dir, 'AGENTS.md'), files['AGENTS.md']);
    assert.equal(read(dir, 'CLAUDE.md'), files['CLAUDE.md']);
    assert.match(stdout, /exists\s+AGENTS\.md \(left unchanged\)/);
    assert.match(stdout, /Note: AGENTS\.md .* does not mention \.dejavu/);
    assert.match(stdout, /Note: CLAUDE\.md .* "@AGENTS\.md"/);
  });

  test('restores only missing files and keeps edited ones', () => {
    const dir = tempRepo();
    run('init', dir);
    fs.writeFileSync(path.join(dir, '.dejavu/ontology.md'), '# Edited\n');
    fs.rmSync(path.join(dir, '.dejavu/topology.md'));
    const { stdout } = run('init', dir);
    assert.equal(read(dir, '.dejavu/ontology.md'), '# Edited\n');
    assert.ok(exists(dir, '.dejavu/topology.md'));
    assert.match(stdout, /create\s+\.dejavu\/topology\.md/);
  });

  test('--no-agents skips agent pointers', () => {
    const dir = tempRepo();
    run('init', dir, '--no-agents');
    assert.ok(!exists(dir, 'AGENTS.md'));
    assert.ok(!exists(dir, 'CLAUDE.md'));
    assert.ok(exists(dir, '.dejavu/README.md'));
  });

  test('--dry-run writes nothing', () => {
    const dir = tempRepo();
    const { code, stdout } = run('init', dir, '--dry-run', '--mode', 'structured');
    assert.equal(code, 0);
    assert.deepEqual(snapshot(dir), {});
    assert.match(stdout, /would create\s+docs\/00-overview\/README\.md/);
  });

  test('templates contain no project facts or leftover placeholders', () => {
    const dir = tempRepo();
    run('init', dir, '--mode', 'structured');
    for (const [rel, text] of Object.entries(snapshot(dir))) {
      assert.doesNotMatch(text, /TODO|lorem|\{\{|undefined/i, rel);
    }
  });
});

describe('init --mode structured', () => {
  test('scaffolds docs/00-overview through docs/06-reference and passes check', () => {
    const dir = tempRepo();
    assert.equal(run('init', dir, '--mode', 'structured').code, 0);
    const sections = ['00-overview', '01-product', '02-design', '03-engineering', '04-decisions', '05-workstreams', '06-reference'];
    for (const s of sections) assert.ok(exists(dir, `docs/${s}/README.md`), s);
    const index = read(dir, '.dejavu/index.md');
    assert.match(index, /\[Documentation\]\(\.\.\/docs\/README\.md\)/);
    assert.match(index, /\[Decisions\]\(\.\.\/docs\/04-decisions\/README\.md\)/);
    assert.match(read(dir, 'AGENTS.md'), /docs\/README\.md/);
    assert.equal(run('check', dir).code, 0);
  });

  test('keeps existing docs and points to adopt-existing', () => {
    const dir = tempRepo({ 'docs/README.md': '# Our docs\n', 'docs/guide.md': '# Guide\n' });
    const { stdout } = run('init', dir, '--mode', 'structured');
    assert.equal(read(dir, 'docs/README.md'), '# Our docs\n');
    assert.equal(read(dir, 'docs/guide.md'), '# Guide\n');
    assert.match(stdout, /Note: docs\/ already had other content/);
  });
});

describe('init --mode adopt-existing', () => {
  test('indexes existing docs with links, without copying or moving them', () => {
    const files = {
      'README.md': '# Sample project\n',
      'CONTRIBUTING.md': 'No heading here.\n',
      'docs/README.md': '# Docs home\n',
      'docs/architecture/overview.md': '# Architecture overview\n\nSecret body text.\n',
      'docs/my notes (draft).md': '# Draft notes\n',
    };
    const dir = tempRepo(files);
    const { code } = run('init', dir, '--mode', 'adopt-existing');
    assert.equal(code, 0);
    const index = read(dir, '.dejavu/index.md');
    assert.match(index, /\[Sample project\]\(\.\.\/README\.md\)/);
    assert.match(index, /\[CONTRIBUTING\.md\]\(\.\.\/CONTRIBUTING\.md\)/);
    assert.match(index, /\[Architecture overview\]\(\.\.\/docs\/architecture\/overview\.md\)/);
    assert.match(index, /\.\.\/docs\/my%20notes%20%28draft%29\.md/);
    assert.doesNotMatch(index, /Secret body text/);
    assert.ok(index.indexOf('docs/README.md') < index.indexOf('docs/architecture'), 'README listed first');
    for (const [rel, text] of Object.entries(files)) assert.equal(read(dir, rel), text);
    assert.ok(!exists(dir, 'docs/00-overview'));
    assert.equal(run('check', dir).code, 0);
  });

  test('discovers nonstandard layouts and extra --docs paths', () => {
    const dir = tempRepo({
      'documentation/guides/setup.md': '# Setup guide\n',
      'adr/0001-use-node.md': '# 1. Use Node\n',
      'handbook/eng/oncall.md': '# On-call\n',
      'handbook/hr/leave.md': '# Leave\n',
      'node_modules/pkg/README.md': '# Should be ignored\n',
    });
    run('init', dir, '--mode', 'adopt-existing', '--docs', 'handbook/eng');
    const index = read(dir, '.dejavu/index.md');
    assert.match(index, /## adr\/\n\n- \[1\. Use Node\]\(\.\.\/adr\/0001-use-node\.md\)/);
    assert.match(index, /## documentation\/\n\n- \[Setup guide\]/);
    assert.match(index, /## handbook\/eng\/\n\n- \[On-call\]/);
    assert.doesNotMatch(index, /Leave|Should be ignored/);
    assert.equal(run('check', dir).code, 0);
  });

  test('summarizes large documentation folders by subfolder instead of truncating', () => {
    const files = { 'docs/README.md': '# Docs\n', 'docs/guide.md': '# Guide\n', 'docs/work/README.md': '# Work dashboard\n' };
    for (let i = 0; i < 90; i++) files[`docs/work/tickets/T-${String(i).padStart(3, '0')}.md`] = `# Ticket ${i}\n`;
    for (let i = 0; i < 30; i++) files[`docs/work/bugs/B-${String(i).padStart(3, '0')}.md`] = `# Bug ${i}\n`;
    for (let i = 0; i < 5; i++) files[`docs/decisions/000${i}.md`] = `# Decision ${i}\n`;
    const dir = tempRepo(files);
    run('init', dir, '--mode', 'adopt-existing');
    const index = read(dir, '.dejavu/index.md');
    assert.match(index, /## docs\/\n\n- \[Docs\]\(\.\.\/docs\/README\.md\)[^\n]*\n- \[Guide\]/);
    assert.match(index, /### docs\/decisions\/\n\n- \[Decision 0\]/);
    assert.match(index, /### docs\/work\/\n\n- \[Work dashboard\][^\n]*\n- \[docs\/work\/\]\(\.\.\/docs\/work\/\) — 121 Markdown files: 1 directly, `bugs\/` \(30\), `tickets\/` \(90\)\./);
    assert.doesNotMatch(index, /Ticket 5|…and/);
    assert.equal(run('check', dir).code, 0);
  });

  test('indexes Spec Kit specs and constitution without requiring Spec Kit', () => {
    const dir = tempRepo({
      '.specify/memory/constitution.md': '# Project constitution\n\n## Testing\n\nEvery feature ships with integration tests.\n',
      '.specify/templates/spec-template.md': '# Template\n',
      'specs/001-login/spec.md': '# Feature: login\n',
      'specs/001-login/plan.md': '# Plan: login\n',
    });
    run('init', dir, '--mode', 'adopt-existing');
    const index = read(dir, '.dejavu/index.md');
    assert.match(index, /## \.specify\/memory\/\n\n- \[Project constitution\]\(\.\.\/\.specify\/memory\/constitution\.md\)/);
    assert.match(index, /## specs\/\n\n- \[Feature: login\]|## specs\/\n\n- \[Plan: login\]/);
    assert.doesNotMatch(index, /spec-template/);
    assert.equal(run('check', dir).code, 0);
    assert.match(run('orient', 'integration tests for features', '--dir', dir).stdout, /Project constitution › Testing/);
  });

  test('reports when there are no documentation folders', () => {
    const dir = tempRepo();
    run('init', dir, '--mode', 'adopt-existing');
    assert.match(read(dir, '.dejavu/index.md'), /_No documentation folders found\._/);
  });

  test('output is deterministic across fresh repositories', () => {
    const files = { 'docs/b.md': '# B\n', 'docs/a.md': '# A\n', 'Z.md': '# Z\n', 'a.md': '# a\n' };
    const one = tempRepo(files);
    const two = tempRepo(files);
    run('init', one, '--mode', 'adopt-existing');
    run('init', two, '--mode', 'adopt-existing');
    assert.deepEqual(snapshot(one), snapshot(two));
  });

  test('suggests regenerating an index created by another mode', () => {
    const dir = tempRepo({ 'docs/a.md': '# A\n' });
    run('init', dir);
    const { stdout } = run('init', dir, '--mode', 'adopt-existing');
    assert.match(stdout, /Note: \.dejavu\/index\.md already exists and was not regenerated/);
    assert.match(read(dir, '.dejavu/index.md'), /minimal/);
  });
});

describe('init --skills', () => {
  test('installs the canonical skill for Claude Code and Codex', () => {
    const dir = tempRepo();
    const { code } = run('init', dir, '--skills', 'all', '--no-agents');
    assert.equal(code, 0);
    const canonical = fs.readFileSync(new URL('../skills/dejavu/SKILL.md', import.meta.url), 'utf8');
    assert.equal(read(dir, '.claude/skills/dejavu/SKILL.md'), canonical);
    assert.equal(read(dir, '.agents/skills/dejavu/SKILL.md'), canonical);
  });

  test('installs a single target and keeps an existing skill', () => {
    const dir = tempRepo({ '.agents/skills/dejavu/SKILL.md': 'custom' });
    run('init', dir, '--skills', 'codex');
    assert.equal(read(dir, '.agents/skills/dejavu/SKILL.md'), 'custom');
    assert.ok(!exists(dir, '.claude/skills'));
  });

  test('canonical SKILL.md has the frontmatter both agents require', () => {
    const text = fs.readFileSync(new URL('../skills/dejavu/SKILL.md', import.meta.url), 'utf8');
    assert.match(text, /^---\nname: dejavu\ndescription: .{20,}\n---\n/);
  });
});
