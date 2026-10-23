// `dejavu handoff` and `dejavu resume`: compact Markdown state for paused work,
// one file per branch in .dejavu/handoffs/ (Git-ignored by default). Never
// stores secrets or transcripts.
import fs from 'node:fs';
import path from 'node:path';
import { branchExists, changedSince, currentBranch, defaultBase, headCommit, isAncestor, isRepo, mergeBase } from './git.mjs';
import { slugify } from './lessons.mjs';
import { frontmatter, sections } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const HANDOFF_DIR = `${KNOWLEDGE_DIR}/handoffs`;
export const MAX_FIELD_CHARS = 500;
const NONE = '_None recorded._';

// Common credential shapes. A match blocks the handoff; the user rewrites it.
export const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API key'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{6,}/i, 'credential assignment'],
];

export class HandoffError extends Error {}

export function findSecret(text) {
  for (const [pattern, label] of SECRET_PATTERNS) if (pattern.test(text)) return label;
  return null;
}


function validate(fields) {
  for (const [name, values] of Object.entries(fields)) {
    for (const value of values) {
      if (value.length > MAX_FIELD_CHARS) {
        throw new HandoffError(`${name} is ${value.length} characters; handoffs are compact (max ${MAX_FIELD_CHARS} per item). Summarize instead of pasting logs or transcripts.`);
      }
      const secret = findSecret(value);
      if (secret) throw new HandoffError(`${name} looks like it contains a ${secret}. Remove it; handoffs must never store secrets.`);
    }
  }
}

const list = (items, ordered = false) =>
  (items.length ? items.map((item, i) => `${ordered ? `${i + 1}.` : '-'} ${item}`).join('\n') : NONE);

/** File name for a branch's handoff: `feature/login` -> `feature-login`. */
export const branchSlug = (branch) => slugify(branch.replace(/\//g, '-'), 'branch');

export function renderHandoff({ date, created, task, branch, base, fork, commit, pr, tests, questions, next }) {
  const meta = [
    '---',
    `date: ${date}`,
    `created: ${created}`,
    `branch: ${branch ?? ''}`,
    `base: ${base ?? ''}`,
    `fork: ${fork ?? ''}`,
    `commit: ${commit ?? ''}`,
    `pr: ${(pr ?? '').replace(/^#/, '')}`,
    'status: open',
    '---',
  ];
  const where = [
    `- Branch: ${branch ? `\`${branch}\`` : '_not a Git branch_'}${base ? ` (base \`${base}\`)` : ''}`,
    `- Commit: ${commit ? `\`${commit}\`` : '_none_'}`,
    `- PR: ${pr ?? '_none_'}`,
  ];
  return [
    ...meta, '',
    `# Handoff: ${task}`, '',
    '## Branch and PR', '', ...where, '',
    '## Tests', '', tests.length ? list(tests) : '_Not recorded._', '',
    '## Unresolved', '', list(questions), '',
    '## Next steps', '', list(next, true), '',
  ].join('\n');
}

/**
 * Write the handoff for the current branch, replacing the branch's previous one,
 * so there is at most one handoff per branch. Outside Git, one per task.
 */
export function createHandoff(root, options) {
  const { task, pr = null, tests = [], questions = [], next = [], now = new Date(), dryRun = false } = options;
  const created = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const date = created.slice(0, 10);
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) {
    throw new HandoffError(`${KNOWLEDGE_DIR}/ not found. Run \`dejavu init\` first.`);
  }
  validate({ task: [task], pr: pr ? [pr] : [], tests, unresolved: questions, next });

  const repo = isRepo(root);
  const branch = repo ? currentBranch(root) : null;
  const base = repo ? defaultBase(root) : null;
  const sharedBase = base && base !== branch ? base : null;
  const contents = renderHandoff({
    date, created, task, branch, base: sharedBase,
    fork: sharedBase ? mergeBase(root, 'HEAD', sharedBase) : null,
    commit: repo ? headCommit(root) : null,
    pr: pr && /^\d+$/.test(pr) ? `#${pr}` : pr, tests, questions, next,
  });

  const rel = `${HANDOFF_DIR}/${branch ? branchSlug(branch) : `${date}-${slugify(task, 'handoff')}`}.md`;
  const replaced = fs.existsSync(path.join(root, rel));
  if (!dryRun) {
    fs.mkdirSync(path.join(root, HANDOFF_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, rel), contents);
  }
  return { path: rel, contents, replaced, warnings: tests.length ? [] : ['No tests recorded. Pass --tests "<command>: <result>" so the next session knows what was verified.'] };
}

/**
 * 'open', or why a handoff no longer applies: 'closed' (by hand), 'branch deleted',
 * or 'merged' (the branch gained commits after it forked and is now in its base).
 */
export function handoffState(root, handoff) {
  const { status = 'open', branch, base, fork } = handoff.fields;
  if (status !== 'open') return status;
  if (!branch || !isRepo(root)) return 'open';
  if (!branchExists(root, branch)) return 'branch deleted';
  if (base && fork && !isAncestor(root, branch, fork) && isAncestor(root, branch, base)) return 'merged';
  return 'open';
}

/** All handoffs, newest first: [{ path, fields, title, text }]. */
export function listHandoffs(root) {
  const dir = path.join(root, HANDOFF_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /\.md$/i.test(name) && !/^readme\.md$/i.test(name))
    .map((name) => {
      const rel = `${HANDOFF_DIR}/${name}`;
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      const { fields, body } = frontmatter(text);
      const title = sections(body).find((s) => s.level === 1)?.heading ?? name;
      return { path: rel, fields: fields ?? {}, title, text };
    })
    // Newest first by creation time, then by file name.
    .map((h) => ({ ...h, key: `${h.fields.created ?? h.fields.date ?? ''} ${h.path}` }))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
    .map(({ key, ...h }) => h);
}

/**
 * The open handoff for the current branch. Handoffs from other branches are
 * only counted, so a session never loads state for work it is not doing.
 * Outside a branch, the newest open handoff.
 */
export function resume(root) {
  const open = listHandoffs(root).filter((h) => handoffState(root, h) === 'open');
  const branch = isRepo(root) ? currentBranch(root) : null;
  const handoff = branch ? open.find((h) => h.fields.branch === branch) ?? null : open[0] ?? null;
  const others = open.filter((h) => h !== handoff).length;
  const notes = [];
  if (handoff?.fields.commit && isRepo(root)) {
    const since = changedSince(root, handoff.fields.commit);
    if (since === null) notes.push(`Commit \`${handoff.fields.commit}\` from the handoff is not in this clone; verify the state before continuing.`);
    else if (since.length) notes.push(`${since.length} file(s) differ from the handoff commit \`${handoff.fields.commit}\`: ${since.slice(0, 10).map((f) => `\`${f}\``).join(', ')}${since.length > 10 ? ', …' : ''}.`);
  }
  if (handoff?.fields.base) notes.push(`For the branch's changes, run \`git diff --stat ${handoff.fields.base}...\`.`);
  if (others) notes.push(`${others} open handoff(s) on other branches; run \`dejavu resume --list\`.`);
  return { handoff, notes };
}
