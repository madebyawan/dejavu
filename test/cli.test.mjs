import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { exists, run, tempRepo } from './helpers.mjs';

const BIN = fileURLToPath(new URL('../bin/dejavu.mjs', import.meta.url));

describe('cli', () => {
  test('prints help with no arguments and for help/--help', () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      const { code, stdout } = run(...argv);
      assert.equal(code, 0);
      assert.match(stdout, /dejavu init \[dir\]/);
      assert.match(stdout, /dejavu check \[dir\]/);
      assert.doesNotMatch(stdout, /orient|learn|reconcile/, 'unshipped commands are not advertised');
    }
  });

  test('prints command help', () => {
    assert.match(run('help', 'init').stdout, /--mode <mode>/);
    assert.match(run('init', '--help').stdout, /adopt-existing/);
    assert.match(run('check', '-h').stdout, /Exits 1 when errors are found/);
  });

  test('prints the package version', () => {
    assert.match(run('--version').stdout, /^\d+\.\d+\.\d+$/);
  });

  test('usage errors exit 2 without writing files', () => {
    const dir = tempRepo();
    const cases = [
      [['orient', 'task'], /unknown command: orient/],
      [['init', dir, '--mode', 'huge'], /unknown mode: huge/],
      [['init', dir, '--skills', 'cursor'], /unknown skill target: cursor/],
      [['init', dir, '--docs', 'nope'], /--docs path not found: nope/],
      [['init', dir, '--docs', '..'], /must be inside the target directory/],
      [['init', dir, '--bogus'], /Unknown option '--bogus'/],
      [['init', dir, 'extra'], /unexpected argument: extra/],
      [['init', `${dir}/missing`], /directory not found/],
      [['check', `${dir}/missing`], /directory not found/],
    ];
    for (const [argv, pattern] of cases) {
      const { code, stderr } = run(...argv);
      assert.equal(code, 2, argv.join(' '));
      assert.match(stderr, pattern);
      assert.match(stderr, /Run `dejavu help` for usage\./);
    }
    assert.ok(!exists(dir, '.dejavu'));
  });

  test('executable runs init and check in the working directory', () => {
    const dir = tempRepo();
    const init = spawnSync(process.execPath, [BIN, 'init'], { cwd: dir, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    assert.ok(exists(dir, '.dejavu/README.md'));
    const check = spawnSync(process.execPath, [BIN, 'check'], { cwd: dir, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
    const bad = spawnSync(process.execPath, [BIN, 'check', tempRepo()], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
  });
});
