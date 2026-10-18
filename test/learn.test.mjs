import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { learn } from '../src/learn.mjs';
import { loadLessons, nextId, parseEvidence, setFields } from '../src/lessons.mjs';
import { exists, fixtureRepo, read, run, snapshot, tempRepo } from './helpers.mjs';

const LESSON = [
  '--summary', 'Verify webhook signatures before storing events',
  '--context', 'Unsigned events reached the worker in staging.',
  '--cause', 'The signature check ran after the insert.',
  '--prevention', 'Verify the signature first and reject on failure.',
];

describe('learn', () => {
  test('writes a proposal with evidence links and the next free ID', () => {
    const dir = fixtureRepo('with-knowledge');
    const { code, stdout } = run('learn', '--dir', dir, ...LESSON, '--evidence', 'docs/architecture.md:3-5',
      '--evidence', '#14', '--evidence', 'madebyawan/dejavu#2', '--evidence', 'https://example.com/review', '--confidence', 'high');
    assert.equal(code, 0);
    assert.match(stdout, /^Proposed P-0002: \.dejavu\/proposals\/P-0002-verify-webhook-signatures-before-storing-events\.md/);
    assert.match(stdout, /not accepted knowledge yet/);
    const text = read(dir, '.dejavu/proposals/P-0002-verify-webhook-signatures-before-storing-events.md');
    assert.match(text, /^---\nid: P-0002\nstatus: proposed\nconfidence: high\ncreated: \d{4}-\d{2}-\d{2}\nsupersedes: \[\]\nsuperseded_by: \[\]\n---\n\n# Verify webhook signatures before storing events\n/);
    assert.match(text, /## Cause\n\nThe signature check ran after the insert\.\n/);
    assert.match(text, /## Evidence\n\n- \[docs\/architecture\.md:3-5\]\(\.\.\/\.\.\/docs\/architecture\.md#L3-L5\)\n- #14\n- madebyawan\/dejavu#2\n- <https:\/\/example\.com\/review>\n/);
    assert.equal(run('check', dir).code, 0, 'evidence links resolve');
  });

  test('never writes to wisdom and orient ignores the proposal', () => {
    const dir = fixtureRepo('with-knowledge');
    const wisdomBefore = Object.keys(snapshot(dir)).filter((p) => p.includes('wisdom/'));
    run('learn', '--dir', dir, ...LESSON, '--evidence', '#1', '--summary', 'Quokka signatures matter');
    const wisdomAfter = Object.keys(snapshot(dir)).filter((p) => p.includes('wisdom/'));
    assert.deepEqual(wisdomAfter, wisdomBefore);
    assert.doesNotMatch(run('orient', 'quokka signatures', '--dir', dir).stdout, /Quokka/);
  });

  test('records supersession candidates that exist', () => {
    const dir = fixtureRepo('with-knowledge');
    const { id } = learn(dir, { summary: 'S', context: 'C', cause: 'K', prevention: 'P', evidence: ['#1'], supersedes: ['W-0001'] });
    assert.match(read(dir, loadLessons(dir).find((l) => l.fields.id === id).path), /supersedes: \[W-0001\]/);
    assert.match(run('learn', '--dir', dir, ...LESSON, '--evidence', '#1', '--supersedes', 'W-0099').stderr, /no lesson with that ID/);
    assert.match(run('learn', '--dir', dir, ...LESSON, '--evidence', '#1', '--supersedes', 'P-0001').stderr, /must reference an accepted lesson ID/);
  });

  test('requires evidence, all fields, and a valid confidence; writes nothing on error', () => {
    const dir = fixtureRepo('with-knowledge');
    const before = snapshot(dir);
    const cases = [
      [[...LESSON], /at least one --evidence is required/],
      [[...LESSON.slice(2), '--evidence', '#1'], /--summary is required/],
      [[...LESSON, '--evidence', '#1', '--prevention', ' '], /--prevention is required/],
      [[...LESSON, '--evidence', '#1', '--confidence', 'certain'], /--confidence must be one of high, medium, low/],
      [[...LESSON, '--evidence', 'docs/missing.md'], /evidence "docs\/missing\.md" is not a URL/],
      [[...LESSON, '--evidence', '../outside.md'], /is not a URL/],
      [[...LESSON, '--evidence', '#1', '--context', 'x'.repeat(1001)], /--context is 1001 characters/],
      [[...LESSON, '--evidence', '#1', '--cause', 'leaked token=abc123456789'], /--cause looks like it contains a credential assignment/],
    ];
    for (const [argv, pattern] of cases) {
      const { code, stderr } = run('learn', '--dir', dir, ...argv);
      assert.equal(code, 1, String(pattern));
      assert.match(stderr, pattern);
    }
    assert.deepEqual(snapshot(dir), before);
  });

  test('--dry-run prints without writing; missing .dejavu/ is an error', () => {
    const dir = fixtureRepo('with-knowledge');
    const { stdout } = run('learn', '--dir', dir, ...LESSON, '--evidence', '#1', '--dry-run');
    assert.match(stdout, /^---\nid: P-0002/);
    assert.ok(!exists(dir, '.dejavu/proposals/P-0002-verify-webhook-signatures-before-storing-events.md'));
    assert.match(run('learn', '--dir', tempRepo(), ...LESSON, '--evidence', '#1').stderr, /\.dejavu\/ not found/);
    assert.match(run('learn', 'oops', '--dir', dir).stderr, /unexpected argument: oops/);
  });
});

describe('lesson helpers', () => {
  test('nextId counts proposals, wisdom, and accepted_as references', () => {
    const lessons = [
      { name: 'P-0003-x.md', fields: { id: 'P-0003' } },
      { name: 'W-0007-y.md', fields: { id: 'W-0007', proposal: 'P-0009' } },
    ];
    assert.equal(nextId(lessons, 'P'), 'P-0010');
    assert.equal(nextId(lessons, 'W'), 'W-0008');
    assert.equal(nextId([], 'W'), 'W-0001');
  });

  test('setFields updates and appends frontmatter without touching the body', () => {
    const text = '---\nid: P-0001\nstatus: proposed\n---\n\n# Body\nstatus: proposed\n';
    assert.equal(setFields(text, { status: 'accepted', accepted_as: 'W-0002', supersedes: ['W-1', 'W-2'] }),
      '---\nid: P-0001\nstatus: accepted\naccepted_as: W-0002\nsupersedes: [W-1, W-2]\n---\n\n# Body\nstatus: proposed\n');
  });

  test('parseEvidence accepts commits that exist in the repository', () => {
    const dir = tempRepo({ 'a.txt': 'a\n' });
    const git = (...a) => spawnSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'x');
    const sha = git('rev-parse', '--short', 'HEAD').stdout.trim();
    assert.deepEqual(parseEvidence(dir, sha, '.dejavu/proposals'), { kind: 'commit', markdown: `commit \`${sha}\`` });
    assert.throws(() => parseEvidence(dir, 'deadbeef', '.dejavu/proposals'), /not a URL/);
  });
});
