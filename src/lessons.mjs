// Shared lesson (proposal and wisdom) storage helpers.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { frontmatter, listValue, sections } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const PROPOSALS_DIR = `${KNOWLEDGE_DIR}/proposals`;
export const WISDOM_DIR = `${KNOWLEDGE_DIR}/wisdom`;
export const CONFIDENCE = ['high', 'medium', 'low'];

export class LessonError extends Error {}

export const slugify = (text, fallback = 'lesson') => text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
  .replace(/[\s_-]+/g, '-').slice(0, 48).replace(/-+$/, '') || fallback;

export const today = (now = new Date()) => now.toISOString().slice(0, 10);

/** Load every lesson file in proposals/ and wisdom/ (README excluded). */
export function loadLessons(root) {
  const out = [];
  for (const [dir, where] of [[PROPOSALS_DIR, 'proposals'], [WISDOM_DIR, 'wisdom']]) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).sort()) {
      if (!/\.md$/i.test(name) || /^readme\.md$/i.test(name)) continue;
      const rel = `${dir}/${name}`;
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      const { fields, body, bodyLine } = frontmatter(text);
      const parts = sections(body, { firstLine: bodyLine });
      out.push({
        path: rel, name, where, text, fields: fields ?? {}, hasFrontmatter: Boolean(fields),
        title: parts.find((p) => p.level === 1)?.heading ?? '',
        sections: Object.fromEntries(parts.filter((p) => p.level === 2).map((p) => [p.heading.toLowerCase(), p])),
        supersedes: listValue(fields?.supersedes),
        supersededBy: listValue(fields?.superseded_by),
      });
    }
  }
  return out;
}

/** Next free ID with the given prefix (P or W), across both folders. */
export function nextId(lessons, prefix) {
  let max = 0;
  for (const l of lessons) {
    for (const value of [l.fields.id, l.fields.accepted_as, l.fields.proposal, l.name]) {
      const m = new RegExp(`^${prefix}-(\\d+)`).exec(value ?? '');
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

const formatValue = (value) => (Array.isArray(value) ? `[${value.join(', ')}]` : String(value));

/** Set frontmatter fields in place, keeping other fields, their order, and the body. */
export function setFields(text, updates) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) throw new LessonError('file has no frontmatter to update');
  const lines = match[1].split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}: ${formatValue(value)}`;
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i === -1) lines.push(line);
    else lines[i] = line;
  }
  return `---\n${lines.join('\n')}\n---${match[2]}${text.slice(match[0].length)}`;
}

function gitOk(root, args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' }).status === 0;
}

/**
 * Classify one evidence reference. Returns { kind, markdown, file? } or throws.
 * Accepts URLs, issue/PR references (#12, owner/repo#12), commit SHAs present in
 * the repository, and existing local paths with an optional :line or :start-end.
 */
export function parseEvidence(root, raw, fromDir) {
  const value = raw.trim();
  if (/^https?:\/\/\S+$/.test(value)) return { kind: 'url', markdown: `<${value}>` };
  if (/^([\w.-]+\/[\w.-]+)?#\d+$/.test(value)) return { kind: 'issue', markdown: value };
  if (/^[0-9a-f]{7,40}$/.test(value) && gitOk(root, ['rev-parse', '--verify', '--quiet', `${value}^{commit}`])) {
    return { kind: 'commit', markdown: `commit \`${value}\`` };
  }
  const m = /^(.+?)(?::(\d+)(?:-(\d+))?)?$/.exec(value);
  const file = m[1].replace(/\\/g, '/').replace(/^\.\//, '');
  const full = path.resolve(root, file);
  const rel = path.relative(root, full);
  if (!rel.startsWith('..') && !path.isAbsolute(rel) && fs.existsSync(full)) {
    const href = path.posix.relative(fromDir, rel.split(path.sep).join('/'));
    const anchor = m[2] ? `#L${m[2]}${m[3] ? `-L${m[3]}` : ''}` : '';
    return { kind: 'file', file: rel.split(path.sep).join('/'), markdown: `[${value}](${href}${anchor})` };
  }
  throw new LessonError(`evidence "${value}" is not a URL, an issue or PR reference (#12, owner/repo#12), a commit in this repository, or an existing file path.`);
}
