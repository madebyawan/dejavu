import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';
import { main } from '../src/cli.mjs';

const dirs = [];
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

/** Create a temp directory populated with { relativePath: contents }. */
export function tempRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dejavu-test-'));
  dirs.push(dir);
  for (const [rel, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), contents);
  }
  return dir;
}

/** Run the CLI in-process and capture its output. */
export function run(...argv) {
  const stdout = [];
  const stderr = [];
  const code = main(argv, {
    log: (...a) => stdout.push(a.join(' ')),
    error: (...a) => stderr.push(a.join(' ')),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

/** Map every file under dir to its contents, for before/after comparisons. */
export function snapshot(dir, rel = '', out = {}) {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) snapshot(dir, child, out);
    else out[child] = fs.readFileSync(path.join(dir, child), 'utf8');
  }
  return out;
}

export const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
export const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));
