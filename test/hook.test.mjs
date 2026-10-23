import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { brief } from '../src/brief.mjs';
import { main } from '../src/cli.mjs';
import { createHandoff } from '../src/handoff.mjs';
import { SETUP_OFFER, handleHook } from '../src/hook.mjs';
import { setDeclined } from '../src/state.mjs';
import { fixtureRepo, run, tempRepo } from './helpers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function git(dir, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function gitRepo(dir = tempRepo({ 'src/app.js': 'export {};\n' })) {
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init', '--allow-empty');
  return dir;
}

const env = () => ({ DEJAVU_STATE_DIR: tempRepo() });
const context = (out) => out?.hookSpecificOutput.additionalContext;

describe('session-start hook', () => {
  test('offers setup in a Git repository without memory, unless declined', () => {
    const dir = gitRepo();
    const e = env();
    const out = handleHook('session-start', { session_id: 's', cwd: path.join(dir, 'src') }, { env: e });
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(context(out), SETUP_OFFER);
    setDeclined(path.join(dir, 'src'), true, e);
    assert.equal(handleHook('session-start', { session_id: 's', cwd: dir }, { env: e }), null);
  });

  test('stays silent outside Git repositories', () => {
    assert.equal(handleHook('session-start', { session_id: 's', cwd: tempRepo() }, { env: env() }), null);
  });

  test('loads the brief when memory exists', () => {
    const dir = gitRepo(fixtureRepo('with-knowledge'));
    const text = context(handleHook('session-start', { session_id: 's', cwd: dir }, { env: env() }));
    assert.match(text, /^# Déjà Vu project memory/);
    assert.match(text, /## Growing memory/);
    assert.match(text, /has not been through `dejavu setup`/);
  });
});

describe('brief', () => {
  test('summarizes knowledge, open handoff, setup progress, and stays within budget', () => {
    const dir = gitRepo(tempRepo({ 'src/engine.js': 'export {};\n' }));
    run('setup', dir);
    run('remember', 'Scores reset on every deploy', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    run('remember', 'Runs the loop', '--as', 'component', '--name', 'Engine', '--source', 'src/engine.js', '--dir', dir);
    for (let i = 0; i < 80; i++) run('remember', `Term number ${i} with a long meaning ${'x'.repeat(100)}`, '--as', 'term', '--name', `T${i}`, '--source', 'maintainer', '--dir', dir);
    createHandoff(dir, { task: 'Wire scoring', now: new Date('2026-03-01T10:00:00Z') });
    const text = brief(dir);
    assert.ok(text.length <= 6000, `brief is ${text.length} chars`);
    assert.match(text, /Known:\n- Scores reset on every deploy \(maintainer, [\d-]+\)/);
    assert.match(text, /Components:\n- Engine — Runs the loop/);
    assert.match(text, /- …and \d+ more in \.dejavu\//);
    assert.match(text, /## Open handoff\n\n\.dejavu\/handoffs\/main\.md \(branch `main`\): Handoff: Wire scoring/);
    assert.match(text, /setup item\(s\) still open in \.dejavu\/setup\.md/);
    assert.match(run('brief', '--dir', dir).stdout, /^# Déjà Vu project memory/);
    assert.match(run('brief', '--dir', tempRepo()).stdout, /Run `dejavu setup`/);
  });

  test('with a graphify graph, points to it instead of listing components', () => {
    const dir = gitRepo(tempRepo({ 'graphify-out/graph.json': '{}' }));
    run('init', dir);
    run('remember', 'Runs the loop', '--as', 'component', '--name', 'Engine', '--source', 'src/engine.js', '--dir', dir);
    const text = brief(dir);
    assert.doesNotMatch(text, /Components:/);
    assert.match(text, /graphify query/);
    assert.doesNotMatch(brief(gitRepo(tempRepo())), /graphify/);
  });
});

describe('prompt hook', () => {
  test('adds matching memory once per section per session', () => {
    const dir = gitRepo(tempRepo());
    run('init', dir);
    run('remember', 'Scores reset on every deploy', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    const e = env();
    const input = { session_id: 's', cwd: dir, prompt: 'why do scores vanish after a deploy' };
    const text = context(handleHook('prompt', input, { env: e }));
    assert.match(text, /Scores reset on every deploy/);
    assert.match(text, /\.dejavu\/epistemology\.md:\d+/);
    assert.equal(handleHook('prompt', input, { env: e }), null, 'not repeated');
    assert.equal(handleHook('prompt', { ...input, session_id: 'other' }, { env: e }) !== null, true, 'new session sees it again');
  });

  test('skips slash commands, tiny prompts, and repositories without memory', () => {
    const dir = gitRepo(tempRepo());
    const e = env();
    assert.equal(handleHook('prompt', { session_id: 's', cwd: dir, prompt: 'scores deploy reset' }, { env: e }), null);
    run('init', dir);
    assert.equal(handleHook('prompt', { session_id: 's', cwd: dir, prompt: '/help me' }, { env: e }), null);
    assert.equal(handleHook('prompt', { session_id: 's', cwd: dir, prompt: 'ok' }, { env: e }), null);
  });
  test('ignores documents that match only one term of the request', () => {
    const dir = gitRepo(tempRepo({ 'docs/billing.md': '# Billing\n\nInvoices are sent monthly.\n' }));
    run('init', dir, '--mode', 'adopt-existing');
    const e = env();
    assert.equal(handleHook('prompt', { session_id: 's', cwd: dir, prompt: 'rename the invoices button colour' }, { env: e }), null);
    assert.match(context(handleHook('prompt', { session_id: 's', cwd: dir, prompt: 'when are invoices sent' }, { env: e })), /docs\/billing\.md/);
  });

  test('with a graphify graph, adds only what code cannot show, within a smaller budget', () => {
    const dir = gitRepo(tempRepo({ 'docs/scoring.md': '# Scoring\n\nScores are computed on deploy.\n', 'graphify-out/graph.json': '{}' }));
    run('init', dir, '--mode', 'adopt-existing');
    run('remember', 'Scores reset on every deploy', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    run('remember', 'Runs scoring on deploy', '--as', 'component', '--name', 'Scorer', '--source', 'src/score.js', '--dir', dir);
    for (let i = 0; i < 20; i++) run('remember', `Scores deploy fact ${i} ${'x'.repeat(200)}`, '--as', 'known', '--source', 'maintainer', '--dir', dir);
    const text = context(handleHook('prompt', { session_id: 's', cwd: dir, prompt: 'why do scores reset on deploy' }, { env: env() }));
    assert.match(text, /Scores reset on every deploy/);
    assert.doesNotMatch(text, /docs\/scoring\.md|topology\.md/);
    assert.ok(text.length <= 400 * 4 + 200, `prompt context is ${text.length} chars`);
  });
});

describe('stop hook', () => {
  test('reminds once after uncommitted changes, unless a handoff was written or the agent asked a question', () => {
    const dir = gitRepo(tempRepo({ 'src/app.js': 'export {};\n' }));
    run('init', dir);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'memory');
    const e = env();
    const now = new Date();
    handleHook('session-start', { session_id: 's', cwd: dir }, { env: e, now });
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir }, { env: e }), null, 'nothing changed');
    run('remember', 'A fact', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir }, { env: e }), null, 'changes inside .dejavu/ do not count');
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'export const x = 1;\n');
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir, last_assistant_message: 'Which option do you want?' }, { env: e }), null);
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir, stop_hook_active: true }, { env: e }), null);
    const out = handleHook('stop', { session_id: 's', cwd: dir, last_assistant_message: 'Done.' }, { env: e });
    assert.equal(out.hookSpecificOutput.hookEventName, 'Stop');
    assert.match(context(out), /record one \(`dejavu handoff/);
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir }, { env: e }), null, 'only once');

    handleHook('session-start', { session_id: 't', cwd: dir }, { env: e, now: new Date(Date.now() - 1000) });
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'export const x = 2;\n');
    createHandoff(dir, { task: 'Done' });
    assert.equal(handleHook('stop', { session_id: 't', cwd: dir }, { env: e }), null, 'handoff already written');
  });

  test('stays silent when the session committed its work', () => {
    const dir = gitRepo(tempRepo({ 'src/app.js': 'export {};\n' }));
    run('init', dir);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'memory');
    const e = env();
    handleHook('session-start', { session_id: 's', cwd: dir }, { env: e });
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'export const x = 1;\n');
    git(dir, 'commit', '-qam', 'finish');
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir, last_assistant_message: 'Done.' }, { env: e }), null);
  });
});

describe('stop hook during setup', () => {
  test('files created by setup are not task work', () => {
    const dir = gitRepo();
    const e = env();
    handleHook('session-start', { session_id: 's', cwd: dir }, { env: e });
    run('setup', dir);
    assert.equal(handleHook('stop', { session_id: 's', cwd: dir, last_assistant_message: 'Setup done.' }, { env: e }), null);
  });
});

describe('hook command', () => {
  test('prints JSON hook output, never fails, and rejects unknown events', () => {
    const dir = gitRepo();
    const out = [];
    const prev = process.env.DEJAVU_STATE_DIR;
    process.env.DEJAVU_STATE_DIR = tempRepo();
    try {
      const code = main(['hook', 'session-start'], { log: (s) => out.push(s), error: () => {} }, { stdin: { cwd: dir } });
      assert.equal(code, 0);
      assert.equal(JSON.parse(out[0]).hookSpecificOutput.additionalContext, SETUP_OFFER);
    } finally {
      if (prev === undefined) delete process.env.DEJAVU_STATE_DIR;
      else process.env.DEJAVU_STATE_DIR = prev;
    }
    assert.equal(run('hook', 'bogus').code, 2);
    const viaBin = spawnSync(process.execPath, [path.join(ROOT, 'bin/dejavu.mjs'), 'hook', 'prompt'], { input: 'not json', encoding: 'utf8' });
    assert.equal(viaBin.status, 0);
    assert.equal(viaBin.stdout, '');
  });

  test('plugin hooks point at the CLI and its events', () => {
    const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8')).hooks;
    const commands = Object.values(hooks).flatMap((groups) => groups.flatMap((g) => g.hooks));
    assert.deepEqual(Object.keys(hooks), ['SessionStart', 'UserPromptSubmit', 'Stop']);
    for (const h of commands) {
      assert.equal(h.command, 'node');
      assert.equal(h.args[0], '${CLAUDE_PLUGIN_ROOT}/bin/dejavu.mjs');
      assert.ok(fs.existsSync(path.join(ROOT, h.args[0].replace('${CLAUDE_PLUGIN_ROOT}/', ''))));
      assert.equal(h.args[1], 'hook');
      assert.ok(['session-start', 'prompt', 'stop'].includes(h.args[2]));
    }
  });
});
