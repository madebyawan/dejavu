import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fixtureRepo, read, run, snapshot, tempRepo } from './helpers.mjs';

const MODES = ['minimal', 'structured', 'adopt-existing'];
const FIXTURES = ['existing-docs', 'nonstandard'];

// Every mode on every sample repository: user files survive, reruns are
// no-ops, and the result passes `dejavu check`.
for (const fixture of FIXTURES) {
  describe(`fixture: ${fixture}`, () => {
    for (const mode of MODES) {
      test(`--mode ${mode}`, () => {
        const dir = fixtureRepo(fixture);
        const original = snapshot(dir);

        assert.equal(run('init', dir, '--mode', mode).code, 0);
        const afterFirst = snapshot(dir);
        for (const [rel, text] of Object.entries(original)) assert.equal(afterFirst[rel], text, rel);

        assert.equal(run('init', dir, '--mode', mode).code, 0);
        assert.deepEqual(snapshot(dir), afterFirst, 'rerun changes nothing');

        const { code, stderr } = run('check', dir);
        assert.equal(code, 0, stderr);
      });
    }
  });
}

test('adopt-existing indexes each fixture layout', () => {
  const docs = fixtureRepo('existing-docs');
  run('init', docs, '--mode', 'adopt-existing');
  assert.match(read(docs, '.dejavu/index.md'), /## docs\/\n\n- \[Documentation\][^\n]*\n- \[Architecture overview\]/);

  const odd = fixtureRepo('nonstandard');
  run('init', odd, '--mode', 'adopt-existing', '--docs', 'handbook');
  const index = read(odd, '.dejavu/index.md');
  for (const heading of ['## adr/', '## documentation/', '## handbook/']) assert.ok(index.includes(heading), heading);
});

test('an empty repository works in every mode', () => {
  for (const mode of MODES) {
    const dir = tempRepo();
    assert.equal(run('init', dir, '--mode', mode).code, 0);
    assert.equal(run('check', dir).code, 0);
  }
});
