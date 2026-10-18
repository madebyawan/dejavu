#!/usr/bin/env node
// Compare a headless, read-only Claude Code run on a task with and without
// `dejavu orient` context. Requires the `claude` CLI; costs API usage.
// Usage: node scripts/benchmark-agent.mjs <repo-dir> "<task>" [--budget 1200] [--max-turns 25]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { orient, renderOrientation } from '../src/orient.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { budget: { type: 'string', default: '1200' }, 'max-turns': { type: 'string', default: '25' } },
});
const [dir, task] = positionals;
if (!dir || !task) {
  console.error('usage: node scripts/benchmark-agent.mjs <repo-dir> "<task>" [--budget N] [--max-turns N]');
  process.exit(2);
}
const root = path.resolve(dir);

const question = `Task: ${task}

Do not edit anything. Identify the 3-6 files (documentation and source) a developer should read first to start this task, and list the project rules or constraints that apply. Answer with a bullet list of paths, then a short list of constraints.`;

function runAgent(prompt) {
  const result = spawnSync('claude', [
    '-p', prompt, '--output-format', 'json', '--max-turns', values['max-turns'],
    '--allowedTools', 'Read,Grep,Glob', '--setting-sources', 'project,local',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try {
    const data = JSON.parse(result.stdout);
    const u = data.usage ?? {};
    return {
      turns: data.num_turns,
      seconds: Math.round((data.duration_ms ?? 0) / 1000),
      inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      outputTokens: u.output_tokens ?? 0,
      costUsd: Number((data.total_cost_usd ?? 0).toFixed(4)),
      answer: data.result,
    };
  } catch {
    return { error: (result.stderr || result.stdout).slice(0, 500) };
  }
}

const context = renderOrientation(orient(root, task, { budget: Number(values.budget) }));
const baseline = runAgent(question);
const withOrient = runAgent(`${question}\n\nContext from \`dejavu orient\` (verify against the linked sources):\n\n${context}`);
console.log(JSON.stringify({ repo: path.basename(root), task, orientTokens: Math.ceil(context.length / 4), baseline, withOrient }, null, 2));
