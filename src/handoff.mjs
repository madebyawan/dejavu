// `dejavu handoff` and `dejavu resume`: compact Markdown session state in
// .dejavu/handoffs/. Never stores secrets or transcripts; never overwrites.
import fs from 'node:fs';
import path from 'node:path';
import { changedFiles, changedSince, currentBranch, defaultBase, headCommit, isRepo } from './git.mjs';
import { frontmatter, sections } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const HANDOFF_DIR = `${KNOWLEDGE_DIR}/handoffs`;
export const MAX_FIELD_CHARS = 500;
const MAX_FILES = 50;
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

const slugify = (text) => text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
  .replace(/[\s_-]+/g, '-').slice(0, 48).replace(/-+$/, '') || 'handoff';

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

export function renderHandoff({ date, created, task, branch, base, commit, pr, files, tests, questions, next }) {
  const shown = files.slice(0, MAX_FILES).map((f) => `\`${f}\``);
  if (files.length > MAX_FILES) shown.push(`…and ${files.length - MAX_FILES} more`);
  const meta = [
    '---',
    `date: ${date}`,
    `created: ${created}`,
    `branch: ${branch ?? ''}`,
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
    '## Changed files', '', list(shown), '',
    '## Tests', '', tests.length ? list(tests) : '_Not recorded._', '',
    '## Unresolved', '', list(questions), '',
    '## Next steps', '', list(next, true), '',
  ].join('\n');
}

export function createHandoff(root, options) {
  const { task, pr = null, tests = [], questions = [], next = [], files: extraFiles = [], now = new Date(), dryRun = false } = options;
  const created = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const date = created.slice(0, 10);
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) {
    throw new HandoffError(`${KNOWLEDGE_DIR}/ not found. Run \`dejavu init\` first.`);
  }
  validate({ task: [task], pr: pr ? [pr] : [], tests, unresolved: questions, next, files: extraFiles });

  const repo = isRepo(root);
  const branch = repo ? currentBranch(root) : null;
  const base = repo ? defaultBase(root) : null;
  const files = [...new Set([...(repo ? changedFiles(root, base) : []), ...extraFiles])]
    .filter((f) => !f.startsWith(`${HANDOFF_DIR}/`))
    .sort();
  const contents = renderHandoff({
    date, created, task, branch, base: base && base !== branch ? base : null, commit: repo ? headCommit(root) : null,
    pr: pr && /^\d+$/.test(pr) ? `#${pr}` : pr, files, tests, questions, next,
  });

  const stem = `${date}-${slugify(task)}`;
  let rel = `${HANDOFF_DIR}/${stem}.md`;
  for (let n = 2; fs.existsSync(path.join(root, rel)); n++) rel = `${HANDOFF_DIR}/${stem}-${n}.md`;
  if (!dryRun) {
    fs.mkdirSync(path.join(root, HANDOFF_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, rel), contents, { flag: 'wx' });
  }
  return { path: rel, contents, warnings: tests.length ? [] : ['No tests recorded. Pass --tests "<command>: <result>" so the next session knows what was verified.'] };
}

/** All handoffs, newest first: [{ path, fields, title }]. */
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

/** Pick the newest open handoff, preferring the current branch. */
export function resume(root) {
  const open = listHandoffs(root).filter((h) => (h.fields.status ?? 'open') === 'open');
  const branch = isRepo(root) ? currentBranch(root) : null;
  const handoff = open.find((h) => branch && h.fields.branch === branch) ?? open[0] ?? null;
  if (!handoff) return { handoff: null, notes: [] };

  const notes = [];
  if (branch && handoff.fields.branch && handoff.fields.branch !== branch) {
    notes.push(`This handoff was written on branch \`${handoff.fields.branch}\`; you are on \`${branch}\`.`);
  }
  if (handoff.fields.commit && isRepo(root)) {
    const since = changedSince(root, handoff.fields.commit);
    if (since === null) notes.push(`Commit \`${handoff.fields.commit}\` from the handoff is not in this clone; verify the state before continuing.`);
    else if (since.length) notes.push(`${since.length} file(s) differ from the handoff commit \`${handoff.fields.commit}\`: ${since.slice(0, 10).map((f) => `\`${f}\``).join(', ')}${since.length > 10 ? ', …' : ''}.`);
  }
  if (open.length > 1) notes.push(`${open.length - 1} other open handoff(s); run \`dejavu resume --list\`. Set \`status: closed\` in a handoff's frontmatter once it is done.`);
  return { handoff, notes };
}
