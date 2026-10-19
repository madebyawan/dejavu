import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { exists, read, run, snapshot, tempRepo } from './helpers.mjs';

function repo() {
  const dir = tempRepo({ 'src/engine.js': 'export {};\n' });
  run('init', dir);
  return dir;
}

describe('remember', () => {
  test('appends facts under the right epistemology heading, replacing the placeholder', () => {
    const dir = repo();
    const one = run('remember', 'Scores reset on every deploy', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    assert.equal(one.code, 0);
    assert.match(one.stdout, /^Added to \.dejavu\/epistemology\.md: - Scores reset on every deploy \(maintainer, \d{4}-\d{2}-\d{2}\)$/);
    run('remember', 'Runs on Node 22', '--as', 'known', '--source', 'src/engine.js:1', '--dir', dir);
    run('remember', 'Will players want accounts?', '--as', 'question', '--dir', dir);
    const text = read(dir, '.dejavu/epistemology.md');
    assert.match(text, /## Known\n\n- Scores reset on every deploy \(maintainer, [\d-]+\)\n- Runs on Node 22 \(\[src\/engine\.js:1\]\(\.\.\/src\/engine\.js#L1\)\)\n\n## Assumptions\n\n_None recorded yet\._/);
    assert.match(text, /## Open questions\n\n- Will players want accounts\?\n/);
    assert.equal(run('check', dir).code, 0, 'source links resolve');
  });

  test('adds term and component rows and skips duplicates', () => {
    const dir = repo();
    run('remember', 'A playable game | with a pipe', '--as', 'term', '--name', 'Cabinet', '--source', 'src/engine.js', '--dir', dir);
    run('remember', 'Runs the game loop', '--as', 'component', '--name', 'Engine', '--depends', 'Renderer', '--source', 'src/engine.js', '--dir', dir);
    assert.match(read(dir, '.dejavu/ontology.md'), /\| ---- \| ------- \| ------ \|\n\| Cabinet \| A playable game \\\| with a pipe \| \[src\/engine\.js\]\(\.\.\/src\/engine\.js\) \|\n$/);
    assert.match(read(dir, '.dejavu/topology.md'), /\| Engine \| Runs the game loop \| Renderer \| \[src\/engine\.js\]\(\.\.\/src\/engine\.js\) \|\n$/);
    assert.match(run('remember', 'Other meaning', '--as', 'term', '--name', 'cabinet', '--source', 'maintainer', '--dir', dir).stdout, /Already recorded/);
    run('remember', 'Scores reset', '--as', 'known', '--source', 'maintainer', '--dir', dir);
    assert.match(run('remember', 'Scores reset', '--as', 'known', '--source', 'maintainer', '--dir', dir).stdout, /Already recorded/);
    assert.equal(run('check', dir).code, 0);
  });

  test('rejects secrets, missing sources, and bad input without writing', () => {
    const dir = repo();
    const before = snapshot(dir);
    for (const [argv, pattern] of [
      [['api_key=abcdefghijkl', '--as', 'known', '--source', 'maintainer'], /credential assignment/],
      [['A fact', '--as', 'known'], /--source is required/],
      [['A fact', '--as', 'known', '--source', 'missing.js'], /is not a URL/],
      [['Meaning', '--as', 'term', '--source', 'maintainer'], /--as term needs --name/],
      [['', '--as', 'known', '--source', 'maintainer'], /needs the text/],
      [['x'.repeat(501), '--as', 'known', '--source', 'maintainer'], /501 characters/],
      [['A fact', '--as', 'rumor', '--source', 'maintainer'], /--as must be one of/],
    ]) {
      const { code, stderr } = run('remember', ...argv, '--dir', dir);
      assert.equal(code, 1, String(pattern));
      assert.match(stderr, pattern);
    }
    assert.deepEqual(snapshot(dir), before);
    assert.equal(run('remember', 'x', '--dir', dir).code, 2, '--as is required');
  });

  test('--dry-run writes nothing; missing .dejavu/ is an error', () => {
    const dir = repo();
    const before = snapshot(dir);
    assert.match(run('remember', 'A fact', '--as', 'known', '--source', 'maintainer', '--dry-run', '--dir', dir).stdout, /^Would add to/);
    assert.deepEqual(snapshot(dir), before);
    const empty = tempRepo();
    assert.match(run('remember', 'A fact', '--as', 'known', '--source', 'maintainer', '--dir', empty).stderr, /Run `dejavu setup` first/);
    assert.ok(!exists(empty, '.dejavu'));
  });
});
