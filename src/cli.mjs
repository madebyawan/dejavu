import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { check } from './check.mjs';
import { DEFAULT_MODE, MODES, SKILL_TARGETS, init } from './init.mjs';
import { DEFAULT_BUDGET, orient, renderOrientation } from './orient.mjs';
import { HandoffError, createHandoff, listHandoffs, resume } from './handoff.mjs';
import { learn } from './learn.mjs';
import { LessonError } from './lessons.mjs';
import { accept, reject, report as reconcileReport, supersede } from './reconcile.mjs';
import { brief } from './brief.mjs';
import { EVENTS, handleHook } from './hook.mjs';
import { KINDS, remember } from './remember.mjs';
import { SETUP_FILE, setup } from './setup.mjs';
import { setDeclined } from './state.mjs';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `dejavu — Git-native knowledge for AI coding agents

Usage:
  dejavu setup [dir]            Set up project memory and list what is missing
  dejavu brief                  Print a short summary of project memory
  dejavu remember <text> --as   Record a confirmed fact, term, or component
  dejavu init [dir] [options]   Create missing Déjà Vu files (never overwrites)
  dejavu check [dir]            Validate .dejavu/ and local links
  dejavu orient <task>          Print bounded, source-linked context for a task
  dejavu handoff --task <text>  Record compact session state in .dejavu/handoffs/
  dejavu resume                 Show the latest open handoff
  dejavu learn --summary <text> Propose an evidence-backed lesson for review
  dejavu reconcile              Review lessons; accept, reject, or supersede them
  dejavu hook <event>           Claude Code hook handler (used by the plugin)
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

const SETUP_HELP = `Usage: dejavu setup [dir] [options]

Set up project memory in dir (default: current directory). Creates .dejavu/
if it is missing (indexing existing docs), then writes .dejavu/setup.md: a
checklist of what memory is missing — overview, key terms, components, sources
of truth, past decisions, known traps, open questions, agent rules. An agent
works through it with the maintainer, recording answers with \`dejavu remember\`.
Existing files are never overwritten, so reruns are safe.

Options:
  --decline      Record that the maintainer does not want Déjà Vu here, so
                 agents stop offering setup
  --undo-decline Let agents offer setup here again
  --no-agents    Do not create AGENTS.md or CLAUDE.md pointers
  --dry-run      Show what would be created without writing
  -h, --help     Show this help
`;

const BRIEF_HELP = `Usage: dejavu brief [options]

Print a short summary of project memory for the start of a session: accepted
lessons, known facts, terms, components, open questions, the open handoff,
setup progress, and how to grow memory. Read-only.

Options:
  --dir <path>   Repository root (default: current directory)
  -h, --help     Show this help
`;

const REMEMBER_HELP = `Usage: dejavu remember <text> --as <kind> --source <ref> [options]

Append one confirmed entry to the knowledge layer. Agents run this only after
the maintainer agrees that something should be remembered.

Kinds:
  known, assumption, question, superseded   .dejavu/epistemology.md
  term        .dejavu/ontology.md (needs --name; text is the meaning)
  component   .dejavu/topology.md (needs --name; text is the responsibility)

Options:
  --source <ref>    File[:line], commit, #12 or owner/repo#12, URL, or
                    "maintainer" for an answer given in conversation
                    (repeatable; required except for assumption and question)
  --name <text>     Term or component name
  --depends <text>  What a component depends on
  --dir <path>      Repository root (default: current directory)
  --dry-run         Show the entry without writing it
  -h, --help        Show this help
`;

const HOOK_HELP = `Usage: dejavu hook <${EVENTS.join('|')}>

Claude Code hook handler. Reads the hook's JSON input on stdin and prints hook
output. The Déjà Vu plugin installs these hooks; you do not run them by hand.

  session-start   Offer setup when a repository has no memory; otherwise
                  add the project brief to the session
  prompt          Add memory relevant to each request (once per section)
  stop            Once per session, remind the agent to record a handoff
                  after files changed
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

const HANDOFF_HELP = `Usage: dejavu handoff --task <text> [options]

Write a compact handoff to .dejavu/handoffs/YYYY-MM-DD-<task>.md. Branch,
commit, and changed files (since the default branch, plus uncommitted) are read
from Git. Existing handoffs are never overwritten. Items longer than 500
characters or that look like secrets are rejected.

Options:
  --task <text>       What the session was doing (required)
  --pr <number|url>   Pull request
  --tests <text>      Test command and result, e.g. "npm test: 53 passed" (repeatable)
  --question <text>   Unresolved question or issue (repeatable)
  --next <text>       Concrete next step (repeatable)
  --file <path>       Extra changed file to list (repeatable)
  --dir <path>        Repository root (default: current directory)
  --dry-run           Print the handoff without writing it
  -h, --help          Show this help
`;

const RESUME_HELP = `Usage: dejavu resume [options]

Print the newest open handoff, preferring one written on the current branch,
with notes about branch mismatches and files changed since it was written.
Handoffs with "status: closed" in their frontmatter are skipped.

Options:
  --list         List all handoffs instead
  --dir <path>   Repository root (default: current directory)
  -h, --help     Show this help
`;

const LEARN_HELP = `Usage: dejavu learn --summary <text> --evidence <ref> [options]

Write a lesson proposal to .dejavu/proposals/P-NNNN-<summary>.md for a
maintainer to review. Proposals are never treated as accepted knowledge and
are never promoted automatically.

Required:
  --summary <text>      One-sentence lesson
  --context <text>      What happened
  --cause <text>        Root cause
  --prevention <text>   How to avoid it next time
  --evidence <ref>      URL, #12 or owner/repo#12, commit SHA, or file[:line]
                        (repeatable; local files and commits must exist)

Options:
  --confidence <level>  high, medium (default), or low
  --supersedes <W-id>   Accepted lesson this would replace (repeatable)
  --dir <path>          Repository root (default: current directory)
  --dry-run             Print the proposal without writing it
  -h, --help            Show this help
`;

const RECONCILE_HELP = `Usage: dejavu reconcile [options]
       dejavu reconcile accept <P-id> --by <name>
       dejavu reconcile reject <P-id> --by <name> --reason <text>
       dejavu reconcile supersede <old W-id> --with <new W-id> --by <name>

Without an action, print a read-only review of .dejavu/proposals/ and
.dejavu/wisdom/: metadata errors, broken evidence links, broken or one-sided
supersession, evidence changed since acceptance, possible duplicates and
contradictions, and proposals awaiting review. Exits 1 when errors are found.

Actions change canonical knowledge and require a named human reviewer (--by).
Agents must not run them on their own. Accepting creates a W-id wisdom entry,
marks the proposal accepted_as that entry (it is kept as history), and marks
lessons it supersedes. Nothing is deleted.

Options:
  --by <name>       Reviewer recorded in the lesson (required for actions)
  --reason <text>   Why a proposal was rejected (required for reject)
  --with <W-id>     Replacement lesson (required for supersede)
  --dir <path>      Repository root (default: current directory)
  --json            Print the review as JSON
  --dry-run         Show which files an action would change without writing
  -h, --help        Show this help
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

function runHandoff(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      task: { type: 'string' },
      pr: { type: 'string' },
      tests: { type: 'string', multiple: true, default: [] },
      question: { type: 'string', multiple: true, default: [] },
      next: { type: 'string', multiple: true, default: [] },
      file: { type: 'string', multiple: true, default: [] },
      dir: { type: 'string', default: '.' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(HANDOFF_HELP);
    return 0;
  }
  if (positionals.length) throw new UsageError(`unexpected argument: ${positionals[0]} (use --task "<text>")`);
  if (!values.task?.trim()) throw new UsageError('handoff needs --task "<what the session was doing>"');
  const root = resolveDir([values.dir]);
  try {
    const result = createHandoff(root, {
      task: values.task.trim(), pr: values.pr, tests: values.tests, questions: values.question,
      next: values.next, files: values.file, dryRun: values['dry-run'],
    });
    if (values['dry-run']) out.log(result.contents.trimEnd());
    else out.log(`Wrote ${result.path}`);
    for (const w of result.warnings) out.log(`Note: ${w}`);
    return 0;
  } catch (err) {
    if (!(err instanceof HandoffError)) throw err;
    out.error(`dejavu handoff: ${err.message}`);
    return 1;
  }
}

function runResume(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      list: { type: 'boolean', default: false },
      dir: { type: 'string', default: '.' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(RESUME_HELP);
    return 0;
  }
  if (positionals.length) throw new UsageError(`unexpected argument: ${positionals[0]}`);
  const root = resolveDir([values.dir]);
  if (values.list) {
    const all = listHandoffs(root);
    if (!all.length) out.log('No handoffs yet. Record one with `dejavu handoff --task "..."`.');
    for (const h of all) out.log(`${(h.fields.status ?? 'open').padEnd(7)} ${h.path}  ${h.fields.branch ? `[${h.fields.branch}] ` : ''}${h.title}`);
    return 0;
  }
  const { handoff, notes } = resume(root);
  if (!handoff) {
    out.log('No open handoffs. Record one with `dejavu handoff --task "..."`.');
    return 0;
  }
  out.log(`Resuming from ${handoff.path}`);
  for (const n of notes) out.log(`Note: ${n}`);
  out.log('');
  out.log(handoff.text.trimEnd());
  return 0;
}

function runLearn(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      summary: { type: 'string' },
      context: { type: 'string' },
      cause: { type: 'string' },
      prevention: { type: 'string' },
      evidence: { type: 'string', multiple: true, default: [] },
      confidence: { type: 'string', default: 'medium' },
      supersedes: { type: 'string', multiple: true, default: [] },
      dir: { type: 'string', default: '.' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(LEARN_HELP);
    return 0;
  }
  if (positionals.length) throw new UsageError(`unexpected argument: ${positionals[0]} (use --summary "<text>")`);
  const root = resolveDir([values.dir]);
  try {
    const result = learn(root, { ...values, dryRun: values['dry-run'] });
    if (values['dry-run']) out.log(result.contents.trimEnd());
    else out.log(`Proposed ${result.id}: ${result.path}\nA maintainer reviews it with \`dejavu reconcile\`; it is not accepted knowledge yet.`);
    return 0;
  } catch (err) {
    if (!(err instanceof LessonError)) throw err;
    out.error(`dejavu learn: ${err.message}`);
    return 1;
  }
}

function runReconcile(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      by: { type: 'string' },
      reason: { type: 'string' },
      with: { type: 'string' },
      dir: { type: 'string', default: '.' },
      json: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(RECONCILE_HELP);
    return 0;
  }
  const [action, id, extra] = positionals;
  const root = resolveDir([values.dir]);
  const dryRun = values['dry-run'];

  if (!action) {
    const r = reconcileReport(root);
    if (values.json) {
      out.log(JSON.stringify(r, null, 2));
      return r.errors.length ? 1 : 0;
    }
    for (const e of r.errors) out.error(`error: ${e}`);
    for (const w of r.warnings) out.log(`warning: ${w}`);
    if (r.pending.length) {
      out.log(`\nAwaiting review (${r.pending.length}):`);
      for (const p of r.pending) {
        const notes = [`${p.confidence} confidence`, `${p.evidence} evidence`, ...(p.supersedes.length ? [`supersedes ${p.supersedes.join(', ')}`] : []), ...(p.similar.length ? [`similar to ${p.similar.join(', ')}`] : [])];
        out.log(`  ${p.id}  ${p.title}  (${notes.join('; ')})`);
      }
      out.log('\nA maintainer decides with `dejavu reconcile accept|reject <id> --by <name>`.');
    }
    out.log(`\n${r.lessons} lesson(s) reviewed: ${r.errors.length} error(s), ${r.warnings.length} warning(s), ${r.pending.length} awaiting review.`);
    return r.errors.length ? 1 : 0;
  }

  if (!['accept', 'reject', 'supersede'].includes(action)) throw new UsageError(`unknown reconcile action: ${action} (expected accept, reject, or supersede)`);
  if (!id) throw new UsageError(`reconcile ${action} needs a lesson id`);
  if (extra) throw new UsageError(`unexpected argument: ${extra}`);
  if (action === 'supersede' && !values.with) throw new UsageError('reconcile supersede needs --with <new W-id>');
  try {
    const opts = { by: values.by, reason: values.reason, dryRun };
    const result = action === 'accept' ? accept(root, id, opts)
      : action === 'reject' ? reject(root, id, opts)
        : supersede(root, id, values.with, opts);
    const verb = dryRun ? 'would ' : '';
    for (const c of result.changes) out.log(`  ${verb}${c.action.padEnd(6)} ${c.path}`);
    const summary = action === 'accept' ? `Accepted ${id} as ${result.id}.`
      : action === 'reject' ? `Rejected ${id}.` : `${id} is superseded by ${values.with}.`;
    out.log(dryRun ? `Dry run: ${summary.replace(/\.$/, '')} (nothing written).` : `${summary} Review the diff and commit it.`);
    return 0;
  } catch (err) {
    if (!(err instanceof LessonError)) throw err;
    out.error(`dejavu reconcile: ${err.message}`);
    return 1;
  }
}

function runSetup(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      decline: { type: 'boolean', default: false },
      'undo-decline': { type: 'boolean', default: false },
      'no-agents': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(SETUP_HELP);
    return 0;
  }
  const root = resolveDir(positionals);
  if (values.decline || values['undo-decline']) {
    setDeclined(root, values.decline);
    out.log(values.decline
      ? 'Recorded: agents will not offer Déjà Vu setup in this repository. Undo with `dejavu setup --undo-decline`.'
      : 'Agents may offer Déjà Vu setup in this repository again.');
    return 0;
  }
  const dryRun = values['dry-run'];
  const result = setup(root, { agents: !values['no-agents'], dryRun });
  out.log(`Déjà Vu setup${dryRun ? ' — dry run, nothing written' : ''}`);
  if (result.mode) out.log(`Created the knowledge layer (mode: ${result.mode}):`);
  for (const r of result.created) {
    out.log(`  ${r.action === 'create' ? (dryRun ? 'would create' : 'create') : 'exists'}`.padEnd(15) + ` ${r.path}`);
  }
  out.log(result.checklistCreated
    ? `${dryRun ? 'Would write' : 'Wrote'} ${SETUP_FILE} with ${result.open.length} item(s) to fill in.`
    : `${SETUP_FILE} already exists (left unchanged): ${result.open.length} open item(s).`);
  for (const title of result.open) out.log(`  - ${title}`);
  if (!result.open.length) {
    out.log('\nNothing left to set up. Run `dejavu check`, then commit .dejavu/.');
    return 0;
  }
  out.log(`
Next steps for the agent running setup:
1. Read the README, docs, and main source folders. Draft what the code shows
   (key terms, components) and record each entry with its source file:
   dejavu remember "<meaning>" --as term --name "<Term>" --source <file>
2. Ask the maintainer about the rest, two or three questions at a time, in
   plain language. Record each answer they give:
   dejavu remember "<fact>" --as known --source maintainer
3. Tick each item in ${SETUP_FILE} when it is answered or skipped.
4. Run \`dejavu check\`, show the maintainer what changed, and suggest
   committing .dejavu/ (and AGENTS.md/CLAUDE.md if they were created).`);
  return 0;
}

function runBrief(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: '.' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(BRIEF_HELP);
    return 0;
  }
  if (positionals.length) throw new UsageError(`unexpected argument: ${positionals[0]}`);
  const root = resolveDir([values.dir]);
  if (!fs.existsSync(path.join(root, '.dejavu'))) {
    out.log('No .dejavu/ here yet. Run `dejavu setup` to create project memory.');
    return 0;
  }
  out.log(brief(root));
  return 0;
}

function runRemember(args, out) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      as: { type: 'string' },
      source: { type: 'string', multiple: true, default: [] },
      name: { type: 'string' },
      depends: { type: 'string' },
      dir: { type: 'string', default: '.' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    out.log(REMEMBER_HELP);
    return 0;
  }
  if (!values.as) throw new UsageError(`remember needs --as (${KINDS.join(', ')})`);
  const root = resolveDir([values.dir]);
  try {
    const result = remember(root, { ...values, text: positionals.join(' '), dryRun: values['dry-run'] });
    if (result.duplicate) out.log(`Already recorded in ${result.path}: ${result.entry}`);
    else out.log(`${values['dry-run'] ? 'Would add to' : 'Added to'} ${result.path}: ${result.entry}`);
    return 0;
  } catch (err) {
    if (!(err instanceof LessonError)) throw err;
    out.error(`dejavu remember: ${err.message}`);
    return 1;
  }
}

function runHook(args, out, input) {
  const [event, extra] = args;
  if (event === '-h' || event === '--help') {
    out.log(HOOK_HELP);
    return 0;
  }
  if (!EVENTS.includes(event)) throw new UsageError(`unknown hook event: ${event ?? '(none)'} (expected ${EVENTS.join(', ')})`);
  if (extra) throw new UsageError(`unexpected argument: ${extra}`);
  // A hook must never break the session: any failure means no output.
  try {
    const result = handleHook(event, input ?? readStdinJson());
    if (result) out.log(JSON.stringify(result));
  } catch {
    // Ignore.
  }
  return 0;
}

function readStdinJson() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
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

export function main(argv, out = console, { stdin } = {}) {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case undefined:
      case 'help':
      case '-h':
      case '--help':
        out.log({ setup: SETUP_HELP, brief: BRIEF_HELP, remember: REMEMBER_HELP, hook: HOOK_HELP, init: INIT_HELP, check: CHECK_HELP, orient: ORIENT_HELP, handoff: HANDOFF_HELP, resume: RESUME_HELP, learn: LEARN_HELP, reconcile: RECONCILE_HELP }[rest[0]] ?? HELP);
        return 0;
      case '-v':
      case '--version':
        out.log(VERSION);
        return 0;
      case 'setup':
        return runSetup(rest, out);
      case 'brief':
        return runBrief(rest, out);
      case 'remember':
        return runRemember(rest, out);
      case 'hook':
        return runHook(rest, out, stdin);
      case 'init':
        return runInit(rest, out);
      case 'check':
        return runCheck(rest, out);
      case 'orient':
        return runOrient(rest, out);
      case 'handoff':
        return runHandoff(rest, out);
      case 'resume':
        return runResume(rest, out);
      case 'learn':
        return runLearn(rest, out);
      case 'reconcile':
        return runReconcile(rest, out);
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
