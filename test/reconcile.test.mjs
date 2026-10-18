import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { learn } from '../src/learn.mjs';
import { loadLessons } from '../src/lessons.mjs';
import { accept, report } from '../src/reconcile.mjs';
import { fixtureRepo, read, run, snapshot } from './helpers.mjs';

const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

const lesson = (id, status, { title = `Lesson ${id}`, extra = '', evidence = '- #1' } = {}) =>
  `---\nid: ${id}\nstatus: ${status}\nconfidence: medium\ncreated: 2026-01-01\nsupersedes: []\nsuperseded_by: []\n${extra}---\n\n# ${title}\n\n## Evidence\n\n${evidence}\n`;

const byId = (dir, id) => loadLessons(dir).find((l) => l.fields.id === id);

describe('reconcile report', () => {
  test('is clean on the fixture, lists pending proposals, and writes nothing', () => {
    const dir = fixtureRepo('with-knowledge');
    const before = snapshot(dir);
    const { code, stdout } = run('reconcile', '--dir', dir);
    assert.equal(code, 0);
    assert.match(stdout, /Awaiting review \(1\):\n {2}P-0001 {2}Raise the webhook timeout to thirty seconds {2}\(low confidence; 1 evidence\)/);
    assert.match(stdout, /3 lesson\(s\) reviewed: 0 error\(s\), 0 warning\(s\), 1 awaiting review\./);
    assert.deepEqual(snapshot(dir), before);
  });

  test('reports metadata errors', () => {
    const dir = fixtureRepo('with-knowledge');
    write(dir, '.dejavu/wisdom/W-0010-bad.md', lesson('W-0010', 'maybe').replace('confidence: medium', 'confidence: sure'));
    write(dir, '.dejavu/wisdom/W-0011-dup.md', lesson('W-0001', 'accepted'));
    write(dir, '.dejavu/proposals/P-0009-noev.md', lesson('P-0009', 'proposed', { evidence: '' }));
    write(dir, '.dejavu/proposals/bare.md', '# No frontmatter\n');
    write(dir, '.dejavu/wisdom/P-0012-wrong-folder.md', lesson('P-0012', 'accepted'));
    write(dir, '.dejavu/proposals/P-0013-gone.md', lesson('P-0013', 'proposed', { evidence: '- [gone](../../src/gone.js)' }));
    const { errors } = report(dir);
    const expect = [
      /W-0010-bad\.md: status "maybe" is not valid in wisdom\//,
      /W-0010-bad\.md: confidence "sure" should be one of/,
      /W-0011-dup\.md: duplicate id W-0001/,
      /W-0011-dup\.md: file name does not start/,
      /P-0009-noev\.md: no items under "## Evidence"/,
      /bare\.md: missing frontmatter/,
      /P-0012-wrong-folder\.md: id P-0012 should look like W-0001 in wisdom\//,
      /P-0013-gone\.md:\d+: broken evidence link to \.\.\/\.\.\/src\/gone\.js/,
    ];
    const all = [...errors, ...report(dir).warnings].join('\n');
    for (const pattern of expect) assert.match(all, pattern);
    assert.equal(run('reconcile', '--dir', dir).code, 1);
  });

  test('reports broken and one-sided supersession', () => {
    const dir = fixtureRepo('with-knowledge');
    write(dir, '.dejavu/wisdom/W-0003-a.md', lesson('W-0003', 'accepted', { extra: '' }).replace('supersedes: []', 'supersedes: [W-0099]'));
    write(dir, '.dejavu/wisdom/W-0004-b.md', lesson('W-0004', 'accepted').replace('superseded_by: []', 'superseded_by: [W-0005]'));
    write(dir, '.dejavu/wisdom/W-0005-c.md', lesson('W-0005', 'accepted').replace('superseded_by: []', 'superseded_by: [W-0004]'));
    write(dir, '.dejavu/wisdom/W-0006-d.md', lesson('W-0006', 'accepted').replace('supersedes: []', 'supersedes: [W-0005]'));
    const { errors, warnings } = report(dir);
    const text = [...errors, ...warnings].join('\n');
    assert.match(text, /W-0003-a\.md: references W-0099, which does not exist/);
    assert.match(text, /W-0004 and W-0005 supersede each other/);
    assert.match(text, /W-0004-b\.md: has superseded_by but status is "accepted"; set status: superseded/);
    assert.match(text, /W-0005-c\.md: W-0006 supersedes it, but it does not record superseded_by W-0006\. Run `dejavu reconcile supersede W-0005 --with W-0006 --by <name>`/);
  });

  test('flags possible duplicates, contradictions, and similar proposals', () => {
    const dir = fixtureRepo('with-knowledge');
    write(dir, '.dejavu/wisdom/W-0003-a.md', lesson('W-0003', 'accepted', { title: 'Cache invoice totals in Redis' }));
    write(dir, '.dejavu/wisdom/W-0004-b.md', lesson('W-0004', 'accepted', { title: 'Never cache invoice totals in Redis' }));
    write(dir, '.dejavu/wisdom/W-0005-c.md', lesson('W-0005', 'accepted', { title: 'Rotate signing keys quarterly' }));
    write(dir, '.dejavu/wisdom/W-0006-d.md', lesson('W-0006', 'accepted', { title: 'Rotate the signing keys every quarter' }));
    learn(dir, { summary: 'Deduplicate webhook events using the idempotency key', context: 'c', cause: 'k', prevention: 'p', evidence: ['#2'] });
    const r = report(dir);
    assert.ok(r.warnings.some((w) => /^possible contradiction: W-0003 .* and W-0004 /.test(w)), r.warnings.join('\n'));
    assert.ok(r.warnings.some((w) => /^possible duplicate: W-0005 .* and W-0006 /.test(w)), r.warnings.join('\n'));
    assert.deepEqual(r.pending.find((p) => p.id === 'P-0002').similar, ['W-0001']);
    assert.match(run('reconcile', '--dir', dir).stdout, /P-0002 .*similar to W-0001/);
  });

  test('warns when local evidence changed after acceptance', () => {
    const dir = fixtureRepo('with-knowledge');
    const git = (...a) => spawnSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t', ...a], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_COMMITTER_DATE: '2026-05-01T00:00:00Z', GIT_AUTHOR_DATE: '2026-05-01T00:00:00Z' },
    });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
    const file = path.join(dir, '.dejavu/wisdom/W-0001-dedupe-webhooks.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('superseded_by: []', 'superseded_by: []\naccepted: 2026-04-01'));
    assert.ok(report(dir).warnings.some((w) => /W-0001-dedupe-webhooks\.md: evidence docs\/architecture\.md changed on 2026-05-01, after 2026-04-01; re-verify/.test(w)));
  });

  test('--json returns the same review', () => {
    const { code, stdout } = run('reconcile', '--json', '--dir', fixtureRepo('with-knowledge'));
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.errors, []);
    assert.equal(data.pending[0].id, 'P-0001');
  });
});

describe('reconcile actions', () => {
  test('accept requires a reviewer, creates wisdom, keeps the proposal, and marks superseded lessons', () => {
    const dir = fixtureRepo('with-knowledge');
    const { id } = learn(dir, { summary: 'Dedupe early', context: 'c', cause: 'k', prevention: 'p', evidence: ['#2'], supersedes: ['W-0001'] });
    const refused = run('reconcile', 'accept', id, '--dir', dir);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /--by <name> is required/);

    const { code, stdout } = run('reconcile', 'accept', id, '--by', 'Maintainer', '--dir', dir);
    assert.equal(code, 0);
    assert.match(stdout, /create +\.dejavu\/wisdom\/W-0003-dedupe-early\.md/);
    assert.match(stdout, /Accepted P-0002 as W-0003\. Review the diff and commit it\./);
    const w = byId(dir, 'W-0003');
    assert.equal(w.fields.status, 'accepted');
    assert.equal(w.fields.proposal, 'P-0002');
    assert.equal(w.fields.accepted_by, 'Maintainer');
    assert.match(w.text, /## Prevention\n\np\n/);
    const p = byId(dir, 'P-0002');
    assert.equal(p.fields.status, 'accepted');
    assert.equal(p.fields.accepted_as, 'W-0003');
    const old = byId(dir, 'W-0001');
    assert.equal(old.fields.status, 'superseded');
    assert.deepEqual(old.supersededBy, ['W-0003']);

    assert.equal(run('reconcile', '--dir', dir).code, 0, 'consistent after accept');
    assert.equal(run('check', dir).code, 0);
    const oriented = run('orient', 'dedupe early webhook', '--dir', dir).stdout;
    assert.match(oriented, /W-0003: Dedupe early/);
    assert.doesNotMatch(oriented, /W-0001:/, 'superseded lesson leaves orient');
    assert.match(run('reconcile', 'accept', id, '--by', 'M', '--dir', dir).stderr, /has status "accepted"; only proposed lessons/);
  });

  test('reject records reviewer and reason', () => {
    const dir = fixtureRepo('with-knowledge');
    assert.match(run('reconcile', 'reject', 'P-0001', '--by', 'M', '--dir', dir).stderr, /--reason is required/);
    const { code } = run('reconcile', 'reject', 'P-0001', '--by', 'M', '--reason', 'Timeout is not the cause', '--dir', dir);
    assert.equal(code, 0);
    const p = byId(dir, 'P-0001');
    assert.equal(p.fields.status, 'rejected');
    assert.equal(p.fields.reason, 'Timeout is not the cause');
    assert.equal(p.fields.rejected_by, 'M');
    assert.equal(report(dir).pending.length, 0);
  });

  test('supersede links two accepted lessons', () => {
    const dir = fixtureRepo('with-knowledge');
    write(dir, '.dejavu/wisdom/W-0003-new.md', lesson('W-0003', 'accepted'));
    const { code } = run('reconcile', 'supersede', 'W-0001', '--with', 'W-0003', '--by', 'M', '--dir', dir);
    assert.equal(code, 0);
    assert.equal(byId(dir, 'W-0001').fields.status, 'superseded');
    assert.deepEqual(byId(dir, 'W-0001').supersededBy, ['W-0003']);
    assert.deepEqual(byId(dir, 'W-0003').supersedes, ['W-0001']);
    assert.match(run('reconcile', 'supersede', 'W-0003', '--with', 'W-0003', '--by', 'M', '--dir', dir).stderr, /cannot supersede itself/);
    assert.match(run('reconcile', 'supersede', 'W-0003', '--with', 'W-0002', '--by', 'M', '--dir', dir).stderr, /replacement must be accepted/);
  });

  test('--dry-run changes nothing', () => {
    const dir = fixtureRepo('with-knowledge');
    const before = snapshot(dir);
    const { code, stdout } = run('reconcile', 'accept', 'P-0001', '--by', 'M', '--dry-run', '--dir', dir);
    assert.equal(code, 0);
    assert.match(stdout, /would create .dejavu\/wisdom\/W-0003-webhook-timeouts\.md/);
    assert.match(stdout, /Dry run: Accepted P-0001 as W-0003 \(nothing written\)/);
    assert.deepEqual(snapshot(dir), before);
  });

  test('usage errors', () => {
    const dir = fixtureRepo('with-knowledge');
    assert.match(run('reconcile', 'promote', 'P-0001', '--dir', dir).stderr, /unknown reconcile action: promote/);
    assert.match(run('reconcile', 'accept', '--dir', dir).stderr, /needs a lesson id/);
    assert.match(run('reconcile', 'supersede', 'W-0001', '--by', 'M', '--dir', dir).stderr, /needs --with/);
    assert.match(run('reconcile', 'accept', 'P-0404', '--by', 'M', '--dir', dir).stderr, /no lesson with id P-0404/);
    assert.throws(() => accept(dir, 'W-0001', { by: 'M' }), /is not a proposal/);
    assert.equal(read(dir, '.dejavu/wisdom/W-0001-dedupe-webhooks.md').includes('status: accepted'), true);
  });
});
