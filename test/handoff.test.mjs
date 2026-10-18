import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { createHandoff, findSecret, listHandoffs, resume } from '../src/handoff.mjs';
import { exists, read, run, snapshot, tempRepo } from './helpers.mjs';

function git(dir, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/** A Git repository on branch `feature` with .dejavu/ committed on main. */
function gitRepo() {
  const dir = tempRepo({ 'src/app.js': 'export {};\n' });
  git(dir, 'init', '-q', '-b', 'main');
  run('init', dir);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feature');
  return dir;
}

const at = (iso) => ({ now: new Date(iso) });

describe('handoff', () => {
  test('records branch, commit, PR, changed files, tests, questions, and next steps', () => {
    const dir = gitRepo();
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'export const x = 1;\n');
    git(dir, 'commit', '-qam', 'change app');
    fs.writeFileSync(path.join(dir, 'src/new.js'), 'new\n');

    const { code, stdout } = run('handoff', '--dir', dir, '--task', 'Add login redirect', '--pr', '42',
      '--tests', 'npm test: 12 passed', '--question', 'Keep query params?', '--next', 'Handle expired sessions', '--next', 'Update docs');
    assert.equal(code, 0);
    const rel = /Wrote (\S+)/.exec(stdout)[1];
    assert.match(rel, /^\.dejavu\/handoffs\/\d{4}-\d{2}-\d{2}-add-login-redirect\.md$/);
    const text = read(dir, rel);
    assert.match(text, /^---\ndate: \d{4}-\d{2}-\d{2}\ncreated: \S+Z\nbranch: feature\ncommit: [0-9a-f]{7,}\npr: 42\nstatus: open\n---\n/);
    assert.match(text, /- Branch: `feature` \(base `main`\)/);
    assert.match(text, /- PR: #42/);
    assert.match(text, /## Changed files\n\n- `src\/app\.js`\n- `src\/new\.js`\n/);
    assert.match(text, /## Tests\n\n- npm test: 12 passed\n/);
    assert.match(text, /## Unresolved\n\n- Keep query params\?\n/);
    assert.match(text, /## Next steps\n\n1\. Handle expired sessions\n2\. Update docs\n/);
    assert.equal(run('check', dir).code, 0);
  });

  test('works outside Git and lists --file paths', () => {
    const dir = tempRepo();
    run('init', dir);
    const { contents } = createHandoff(dir, { task: 'Spike', files: ['notes/plan.md'], ...at('2026-01-02T03:04:05Z') });
    assert.match(contents, /- Branch: _not a Git branch_/);
    assert.match(contents, /- `notes\/plan\.md`/);
    assert.match(contents, /## Tests\n\n_Not recorded\._/);
  });

  test('never overwrites: same task and day gets a numbered file', () => {
    const dir = gitRepo();
    const one = createHandoff(dir, { task: 'Fix bug', ...at('2026-03-01T10:00:00Z') });
    const two = createHandoff(dir, { task: 'Fix bug', ...at('2026-03-01T11:00:00Z') });
    assert.equal(one.path, '.dejavu/handoffs/2026-03-01-fix-bug.md');
    assert.equal(two.path, '.dejavu/handoffs/2026-03-01-fix-bug-2.md');
    assert.ok(exists(dir, one.path) && exists(dir, two.path));
    assert.equal(listHandoffs(dir)[0].path, two.path, 'newest first');
  });

  test('rejects secrets and transcript-sized items without writing', () => {
    const dir = gitRepo();
    const before = snapshot(dir);
    for (const [flag, value, pattern] of [
      ['--tests', 'API_KEY=sk-abcdefghijklmnopqrstuvwxyz', /looks like it contains a (API key|credential assignment)/],
      ['--next', `use ghp_${'a'.repeat(36)}`, /GitHub token/],
      ['--question', 'password: hunter2hunter2', /credential assignment/],
      ['--next', 'x'.repeat(501), /handoffs are compact/],
    ]) {
      const { code, stderr } = run('handoff', '--dir', dir, '--task', 'Task', flag, value);
      assert.equal(code, 1, value.slice(0, 20));
      assert.match(stderr, pattern);
    }
    assert.deepEqual(snapshot(dir), before);
  });

  test('findSecret ignores ordinary prose', () => {
    assert.equal(findSecret('Rotate the token after the deploy; see the secrets runbook.'), null);
    assert.equal(findSecret('-----BEGIN RSA PRIVATE KEY-----'), 'private key');
  });

  test('--dry-run prints without writing, and warns when no tests are recorded', () => {
    const dir = gitRepo();
    const { code, stdout } = run('handoff', '--dir', dir, '--task', 'Preview', '--dry-run');
    assert.equal(code, 0);
    assert.match(stdout, /# Handoff: Preview/);
    assert.match(stdout, /Note: No tests recorded/);
    assert.equal(listHandoffs(dir).length, 0);
  });

  test('errors', () => {
    const dir = tempRepo();
    assert.match(run('handoff', '--dir', dir).stderr, /handoff needs --task/);
    assert.match(run('handoff', 'oops', '--dir', dir).stderr, /unexpected argument: oops/);
    const missing = run('handoff', '--dir', dir, '--task', 'x');
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /\.dejavu\/ not found/);
  });
});

describe('resume', () => {
  test('shows the newest open handoff for the current branch, with drift notes', () => {
    const dir = gitRepo();
    createHandoff(dir, { task: 'Feature work', ...at('2026-03-01T10:00:00Z') });
    git(dir, 'checkout', '-q', 'main');
    createHandoff(dir, { task: 'Main work', ...at('2026-03-02T10:00:00Z') });
    git(dir, 'checkout', '-q', 'feature');
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'changed\n');

    const { code, stdout } = run('resume', '--dir', dir);
    assert.equal(code, 0);
    assert.match(stdout, /^Resuming from \.dejavu\/handoffs\/2026-03-01-feature-work\.md/);
    assert.match(stdout, /Note: 1 file\(s\) differ from the handoff commit `[0-9a-f]+`: `src\/app\.js`/);
    assert.match(stdout, /Note: 1 other open handoff\(s\)/);
    assert.match(stdout, /# Handoff: Feature work/);
  });

  test('falls back to the newest open handoff and flags a branch mismatch', () => {
    const dir = gitRepo();
    createHandoff(dir, { task: 'Old', ...at('2026-03-01T10:00:00Z') });
    git(dir, 'checkout', '-q', '-b', 'other');
    const { handoff, notes } = resume(dir);
    assert.equal(handoff.title, 'Handoff: Old');
    assert.match(notes[0], /written on branch `feature`; you are on `other`/);
  });

  test('skips closed handoffs and lists all with --list', () => {
    const dir = gitRepo();
    const { path: rel } = createHandoff(dir, { task: 'Done thing', ...at('2026-03-01T10:00:00Z') });
    const file = path.join(dir, rel);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('status: open', 'status: closed'));
    assert.match(run('resume', '--dir', dir).stdout, /No open handoffs/);
    assert.match(run('resume', '--list', '--dir', dir).stdout, /^closed  \.dejavu\/handoffs\/2026-03-01-done-thing\.md  \[feature\] Handoff: Done thing$/m);
  });

  test('handles repositories without handoffs', () => {
    assert.match(run('resume', '--dir', tempRepo()).stdout, /No open handoffs/);
    assert.match(run('resume', '--list', '--dir', tempRepo()).stdout, /No handoffs yet/);
  });

  test('orient never includes handoffs', () => {
    const dir = gitRepo();
    createHandoff(dir, { task: 'Unique zebra migration', ...at('2026-03-01T10:00:00Z') });
    assert.doesNotMatch(run('orient', 'zebra migration', '--dir', dir).stdout, /handoffs\//);
  });
});
