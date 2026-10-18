import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { corpus, estimateTokens, orient, rank, renderOrientation, tokenize } from '../src/orient.mjs';
import { fixtureRepo, run, tempRepo } from './helpers.mjs';

const TASK = 'fix duplicate webhook processing';

describe('orient', () => {
  test('retrieves docs and accepted knowledge with source links and labels', () => {
    const dir = fixtureRepo('with-knowledge');
    const { code, stdout } = run('orient', TASK, '--dir', dir);
    assert.equal(code, 0);
    assert.match(stdout, /^# Orientation: fix duplicate webhook processing/);
    assert.match(stdout, /Read first: \[AGENTS\.md\]\(AGENTS\.md\), \[\.dejavu\/index\.md\]/);
    assert.match(stdout, /W-0001: Deduplicate webhook events[\s\S]*?\[\.dejavu\/wisdom\/W-0001-dedupe-webhooks\.md:1\]\([^)]*\) · accepted lesson/);
    assert.match(stdout, /### \d\. Webhooks\n\n\[docs\/architecture\.md:3\]\(docs\/architecture\.md#L3\) · source/);
    assert.match(stdout, /· known\n/);
    assert.match(stdout, /· assumption\n/);
    assert.match(stdout, /Idempotency key[\s\S]*?· knowledge/);
    // Links inside excerpts are rebased to the repository root.
    assert.match(stdout, /\[architecture doc\]\(docs\/architecture\.md\)/);
  });

  test('never includes proposals, superseded lessons, superseded facts, or handoffs', () => {
    const { stdout } = run('orient', 'webhook timeout retry polled hourly session state', '--dir', fixtureRepo('with-knowledge'));
    assert.doesNotMatch(stdout, /P-0001|thirty seconds/);
    assert.doesNotMatch(stdout, /W-0002|until it succeeds/);
    assert.doesNotMatch(stdout, /polled hourly instead/);
    assert.doesNotMatch(stdout, /handoffs/);
  });

  test('ranks the most relevant section first', () => {
    const { chunks } = corpus(fixtureRepo('with-knowledge'));
    assert.equal(rank(chunks, 'postgres migrations backwards compatible')[0].heading, 'Database');
    assert.equal(rank(chunks, TASK)[0].path, '.dejavu/wisdom/W-0001-dedupe-webhooks.md');
  });

  test('output is smaller than loading all project docs and respects the budget', () => {
    const dir = fixtureRepo('with-knowledge');
    for (const budget of [200, 400, 1200]) {
      const result = orient(dir, TASK, { budget });
      const output = renderOrientation(result);
      assert.ok(estimateTokens(output) <= budget, `budget ${budget}: ${estimateTokens(output)} tokens`);
      assert.ok(output.length < result.totalChars, `budget ${budget}: ${output.length} >= ${result.totalChars}`);
    }
    const small = orient(dir, TASK, { budget: 300 }).selected.length;
    const large = orient(dir, TASK, { budget: 1200 }).selected.length;
    assert.ok(small >= 1 && small < large);
  });

  test('is reproducible', () => {
    const one = run('orient', TASK, '--dir', fixtureRepo('with-knowledge')).stdout;
    const two = run('orient', TASK, '--dir', fixtureRepo('with-knowledge')).stdout;
    assert.equal(one, two);
  });

  test('--json lists selections with scores', () => {
    const { code, stdout } = run('orient', TASK, '--dir', fixtureRepo('with-knowledge'), '--json');
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.task, TASK);
    assert.deepEqual(data.readFirst, ['AGENTS.md']);
    assert.equal(data.selected[0].kind, 'accepted lesson');
    assert.ok(data.selected.every((s, i, all) => i === 0 || all[i - 1].score >= s.score));
  });

  test('works on repositories without .dejavu/ and explains what is missing', () => {
    const { code, stdout } = run('orient', 'deploy', '--dir', fixtureRepo('nonstandard'));
    assert.equal(code, 0);
    assert.match(stdout, /No \.dejavu\/ found; only documentation was searched/);
  });

  test('reports when nothing matches', () => {
    const { code, stdout } = run('orient', 'zebra quantum', '--dir', fixtureRepo('with-knowledge'));
    assert.equal(code, 0);
    assert.match(stdout, /No sections matched this task across \d+ file\(s\)/);
  });

  test('usage errors', () => {
    const dir = tempRepo();
    for (const [argv, pattern] of [
      [['orient', '--dir', dir], /orient needs a task description/],
      [['orient', 'x', '--dir', dir, '--budget', '50'], /--budget must be an integer of at least 200/],
      [['orient', 'x', '--dir', dir, '--budget', 'lots'], /--budget must be an integer/],
      [['orient', 'x', '--dir', `${dir}/missing`], /directory not found/],
    ]) {
      const { code, stderr } = run(...argv);
      assert.equal(code, 2);
      assert.match(stderr, pattern);
    }
  });

  test('tokenize drops stopwords and light plurals', () => {
    assert.deepEqual(tokenize('How do we fix the Webhooks?'), ['webhook']);
  });
});
