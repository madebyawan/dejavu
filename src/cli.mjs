import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { check } from './check.mjs';
import { DEFAULT_MODE, MODES, SKILL_TARGETS, init } from './init.mjs';
import { DEFAULT_BUDGET, orient, renderOrientation } from './orient.mjs';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `dejavu — Git-native knowledge for AI coding agents

Usage:
  dejavu init [dir] [options]   Create missing Déjà Vu files (never overwrites)
  dejavu check [dir]            Validate .dejavu/ and local links
  dejavu orient <task>          Print bounded, source-linked context for a task
  dejavu help [command]         Show help

Options:
  -h, --help       Show help
  -v, --version    Show version

Run \`dejavu help <command>\` for command options.
`;

const INIT_HELP = `Usage: dejavu init [dir] [options]

Create missing Déjà Vu files in dir (default: current directory). Existing
files are never modified, moved, or deleted, so reruns are safe.

Options:
  --mode <mode>      minimal (default)  .dejavu/ plus thin agent pointers
                     structured         also docs/00-overview … docs/06-reference
                     adopt-existing     .dejavu/ with an index of existing docs
  --docs <path>      Extra documentation path to index (repeatable)
  --skills <list>    Install the agent skill: claude, codex, or all
  --no-agents        Do not create AGENTS.md or CLAUDE.md pointers
  --dry-run          Show what would be created without writing
  -h, --help         Show this help
`;

const CHECK_HELP = `Usage: dejavu check [dir]

Verify that .dejavu/ has its required files and that local links in .dejavu/,
AGENTS.md, and CLAUDE.md resolve. Exits 1 when errors are found.
`;

const ORIENT_HELP = `Usage: dejavu orient <task> [options]

Rank sections of the repository's documentation and accepted .dejavu/
knowledge (ontology, topology, epistemology, wisdom) against the task and print
the most relevant excerpts with source links, within a token budget.
Proposals, handoffs, and superseded entries are never included. Read-only.

Options:
  --dir <path>       Repository root (default: current directory)
  --budget <tokens>  Maximum output size in estimated tokens (default: ${DEFAULT_BUDGET})
  --json             Print machine-readable JSON instead of Markdown
  -h, --help         Show this help
`;

class UsageError extends Error {}

function resolveDir(positionals) {
  if (positionals.length > 1) throw new UsageError(`unexpected argument: ${positionals[1]}`);
  const dir = path.resolve(positionals[0] ?? '.');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new UsageError(`directory not found: ${positionals[0]}`);
  }
  return dir;
}

function parseSkills(value) {
  if (!value) return [];
  const names = value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const agents = Object.keys(SKILL_TARGETS);
  if (names.includes('all')) return agents;
  for (const name of names) {
    if (!agents.includes(name)) throw new UsageError(`unknown skill target: ${name} (expected ${agents.join(', ')}, or all)`);
  }
  return agents.filter((a) => names.includes(a));
}

function runInit(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      mode: { type: 'string', default: DEFAULT_MODE },
      docs: { type: 'string', multiple: true, default: [] },
      skills: { type: 'string' },
      'no-agents': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(INIT_HELP);
    return 0;
  }
  if (!MODES.includes(values.mode)) {
    throw new UsageError(`unknown mode: ${values.mode} (expected ${MODES.join(', ')})`);
  }
  const root = resolveDir(positionals);
  for (const docs of values.docs) {
    const full = path.resolve(root, docs);
    const rel = path.relative(root, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UsageError(`--docs path must be inside the target directory: ${docs}`);
    if (!fs.existsSync(full)) throw new UsageError(`--docs path not found: ${docs}`);
  }

  const options = {
    mode: values.mode,
    agents: !values['no-agents'],
    skills: parseSkills(values.skills),
    extraRoots: values.docs.map((d) => path.relative(root, path.resolve(root, d))),
    dryRun: values['dry-run'],
  };
  const { results, hints } = init(root, options);

  const created = results.filter((r) => r.action === 'create');
  const kept = results.filter((r) => r.action === 'exists');
  out.log(`Déjà Vu init (mode: ${options.mode})${options.dryRun ? ' — dry run, nothing written' : ''}`);
  for (const r of results) {
    const label = r.action === 'create' ? (options.dryRun ? 'would create' : 'create') : 'exists';
    out.log(`  ${label.padEnd(12)} ${r.path}${r.action === 'exists' ? ' (left unchanged)' : ''}`);
  }
  out.log('');
  out.log(`${options.dryRun ? 'Would create' : 'Created'} ${created.length} file(s); left ${kept.length} existing file(s) unchanged.`);
  for (const hint of hints) out.log(`Note: ${hint}`);
  if (!options.dryRun) out.log('Next: review the new files, then run `dejavu check`.');
  return 0;
}

function runOrient(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: '.' },
      budget: { type: 'string', default: String(DEFAULT_BUDGET) },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(ORIENT_HELP);
    return 0;
  }
  const task = positionals.join(' ').trim();
  if (!task) throw new UsageError('orient needs a task description, e.g. dejavu orient "fix login redirect"');
  const budget = Number(values.budget);
  if (!Number.isInteger(budget) || budget < 200) throw new UsageError(`--budget must be an integer of at least 200: ${values.budget}`);
  const root = resolveDir([values.dir]);

  const result = orient(root, task, { budget });
  if (values.json) {
    out.log(JSON.stringify({
      task, budget,
      readFirst: result.instructions,
      selected: result.selected.map(({ path: p, line, heading, kind, score }) => ({ path: p, line, heading, kind, score: Number(score.toFixed(4)) })),
      chunks: result.chunkCount,
      files: result.fileCount,
      totalChars: result.totalChars,
    }, null, 2));
  } else {
    out.log(renderOrientation(result).trimEnd());
  }
  return 0;
}

function runCheck(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { help: { type: 'boolean', short: 'h', default: false } },
  });
  if (values.help) {
    out.log(CHECK_HELP);
    return 0;
  }
  const { errors, warnings, checked } = check(resolveDir(positionals));
  for (const e of errors) out.error(`error: ${e}`);
  for (const w of warnings) out.log(`warning: ${w}`);
  if (errors.length) {
    out.error(`\ndejavu check failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
    return 1;
  }
  out.log(`dejavu check passed: ${checked} file(s) checked, ${warnings.length} warning(s).`);
  return 0;
}

export function main(argv, out = console) {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case undefined:
      case 'help':
      case '-h':
      case '--help':
        out.log({ init: INIT_HELP, check: CHECK_HELP, orient: ORIENT_HELP }[rest[0]] ?? HELP);
        return 0;
      case '-v':
      case '--version':
        out.log(VERSION);
        return 0;
      case 'init':
        return runInit(rest, out);
      case 'check':
        return runCheck(rest, out);
      case 'orient':
        return runOrient(rest, out);
      default:
        throw new UsageError(`unknown command: ${command}`);
    }
  } catch (err) {
    if (err instanceof UsageError || err.code?.startsWith?.('ERR_PARSE_ARGS')) {
      out.error(`dejavu: ${err.message}\nRun \`dejavu help\` for usage.`);
      return 2;
    }
    throw err;
  }
}
