import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { findGaps, openItems, setupStatus } from '../src/setup.mjs';
import { isDeclined } from '../src/state.mjs';
import { exists, fixtureRepo, read, run, snapshot, tempRepo } from './helpers.mjs';

describe('setup', () => {
  test('creates .dejavu/ and a checklist of every gap in an empty repository', () => {
    const dir = tempRepo({ 'src/main.js': 'export {};\n' });
    const { code, stdout } = run('setup', dir);
    assert.equal(code, 0);
    assert.match(stdout, /Created the knowledge layer \(mode: minimal\)/);
    assert.match(stdout, /Wrote \.dejavu\/setup\.md with 9 item\(s\)/);
    assert.match(stdout, /dejavu remember "<fact>" --as known --source maintainer/);
    assert.ok(exists(dir, '.dejavu/ontology.md') && exists(dir, 'AGENTS.md'));
    const checklist = read(dir, '.dejavu/setup.md');
    assert.match(checklist, /^# Déjà Vu setup\n/);
    assert.match(checklist, /^- \[ \] \*\*Overview\*\* — Ask:/m);
    assert.deepEqual(openItems(dir), ['Overview', 'Key terms', 'Components', 'Sources of truth', 'Past decisions',
      'Things the code does not show', 'Known traps', 'Open questions', 'Agent rules']);
    assert.equal(run('check', dir).code, 0);
  });

  test('adopts existing docs and only lists what is missing', () => {
    const dir = fixtureRepo('with-knowledge');
    const titles = findGaps(dir).map((g) => g.title);
    assert.ok(!titles.includes('Key terms'), 'fixture ontology has terms');
    assert.ok(!titles.includes('Known traps'), 'fixture has lessons');
    assert.ok(titles.includes('Agent rules'));
    const before = snapshot(dir);
    run('setup', dir);
    const after = snapshot(dir);
    assert.deepEqual(Object.keys(after).filter((p) => !(p in before)), ['.dejavu/setup.md'], 'only the checklist is added');
    for (const [p, text] of Object.entries(before)) assert.equal(after[p], text, `${p} unchanged`);
  });

  test('never overwrites the checklist and reports progress on rerun', () => {
    const dir = tempRepo();
    run('setup', dir);
    const file = path.join(dir, '.dejavu/setup.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [ ] **Overview**', '- [x] **Overview**'));
    const ticked = fs.readFileSync(file, 'utf8');
    const { stdout } = run('setup', dir);
    assert.match(stdout, /already exists \(left unchanged\): 8 open item\(s\)/);
    assert.equal(fs.readFileSync(file, 'utf8'), ticked);
    assert.deepEqual(setupStatus(dir).state, 'open');
    fs.writeFileSync(file, ticked.replace(/- \[ \]/g, '- [x]'));
    assert.deepEqual(setupStatus(dir), { state: 'done', open: [] });
    assert.match(run('setup', dir).stdout, /Nothing left to set up/);
  });

  test('status distinguishes missing, unchecked, and open', () => {
    const dir = tempRepo();
    assert.equal(setupStatus(dir).state, 'missing');
    run('init', dir);
    assert.equal(setupStatus(dir).state, 'unchecked');
    run('setup', dir);
    assert.equal(setupStatus(dir).state, 'open');
  });

  test('--dry-run writes nothing', () => {
    const dir = tempRepo();
    const { stdout } = run('setup', dir, '--dry-run');
    assert.match(stdout, /dry run, nothing written/);
    assert.match(stdout, /would create/);
    assert.deepEqual(snapshot(dir), {});
  });

  test('--decline is recorded outside the repository and can be undone', () => {
    const dir = tempRepo();
    const state = tempRepo();
    process.env.DEJAVU_STATE_DIR = state;
    try {
      assert.match(run('setup', dir, '--decline').stdout, /will not offer Déjà Vu setup/);
      assert.ok(isDeclined(dir, process.env));
      assert.deepEqual(snapshot(dir), {}, 'nothing written to the repository');
      run('setup', dir, '--undo-decline');
      assert.ok(!isDeclined(dir, process.env));
    } finally {
      delete process.env.DEJAVU_STATE_DIR;
    }
  });
});
