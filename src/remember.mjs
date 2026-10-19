// `dejavu remember`: append one confirmed fact, term, or component to the
// knowledge layer with its source. Appends only; never rewrites entries.
import fs from 'node:fs';
import path from 'node:path';
import { findSecret } from './handoff.mjs';
import { LessonError, parseEvidence, today } from './lessons.mjs';
import { firstTable } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const KINDS = ['known', 'assumption', 'question', 'superseded', 'term', 'component'];
const MAX_CHARS = 500;
const HEADINGS = { known: 'Known', assumption: 'Assumptions', question: 'Open questions', superseded: 'Superseded' };
const MAINTAINER = /^(maintainer|owner|user)$/i;

function renderSources(root, sources, now) {
  return sources.map((raw) => (MAINTAINER.test(raw.trim())
    ? `maintainer, ${today(now)}`
    : parseEvidence(root, raw, KNOWLEDGE_DIR).markdown)).join(', ');
}

function check(label, value) {
  if (value.length > MAX_CHARS) throw new LessonError(`${label} is ${value.length} characters; keep entries under ${MAX_CHARS} and link to details instead.`);
  const secret = findSecret(value);
  if (secret) throw new LessonError(`${label} looks like it contains a ${secret}. Never record secrets.`);
}

function appendToSection(text, heading, item) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${heading}\\s*$`, 'i').test(l));
  if (start < 0) return `${text.trimEnd()}\n\n## ${heading}\n\n${item}\n`;
  let end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  if (end < 0) end = lines.length;
  const placeholder = lines.findIndex((l, i) => i > start && i < end && /^_None recorded( yet)?\._$/.test(l.trim()));
  if (placeholder >= 0) {
    lines[placeholder] = item;
    return lines.join('\n');
  }
  let last = end - 1;
  while (last > start && !lines[last].trim()) last--;
  lines.splice(last + 1, 0, ...(last === start ? ['', item] : [item]));
  return lines.join('\n');
}

const cell = (s) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function appendRow(text, rel, cells) {
  const table = firstTable(text);
  if (!table) throw new LessonError(`${rel} has no table to add to.`);
  if (table.header.length !== cells.length) {
    throw new LessonError(`${rel} has ${table.header.length} columns (${table.header.join(', ')}); expected ${cells.length}. Edit it by hand.`);
  }
  const lines = text.split('\n');
  lines.splice(table.end, 0, `| ${cells.map(cell).join(' | ')} |`);
  return lines.join('\n');
}

export function remember(root, { text, as, name, depends, source = [], dryRun = false, now = new Date() }) {
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) throw new LessonError(`${KNOWLEDGE_DIR}/ not found. Run \`dejavu setup\` first.`);
  if (!KINDS.includes(as)) throw new LessonError(`--as must be one of ${KINDS.join(', ')}`);
  const value = (text ?? '').trim();
  if (!value) throw new LessonError('remember needs the text to record');
  check('text', value);
  if ((as === 'term' || as === 'component') && !name?.trim()) throw new LessonError(`--as ${as} needs --name`);
  if (name) check('--name', name);
  if (!source.length && !['assumption', 'question'].includes(as)) {
    throw new LessonError('--source is required: a file path, commit, issue, URL, or "maintainer" for an answer given in conversation');
  }
  const sources = renderSources(root, source, now);

  const rel = as === 'term' ? `${KNOWLEDGE_DIR}/ontology.md`
    : as === 'component' ? `${KNOWLEDGE_DIR}/topology.md` : `${KNOWLEDGE_DIR}/epistemology.md`;
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new LessonError(`${rel} not found. Run \`dejavu init\` to restore missing files.`);
  const before = fs.readFileSync(full, 'utf8');

  let after;
  let entry;
  if (as === 'term') {
    const existing = firstTable(before)?.rows.find((r) => r.cells[0].toLowerCase() === name.trim().toLowerCase());
    if (existing) return { path: rel, entry: name.trim(), duplicate: true };
    entry = name.trim();
    after = appendRow(before, rel, [entry, value, sources]);
  } else if (as === 'component') {
    const existing = firstTable(before)?.rows.find((r) => r.cells[0].toLowerCase() === name.trim().toLowerCase());
    if (existing) return { path: rel, entry: name.trim(), duplicate: true };
    entry = name.trim();
    after = appendRow(before, rel, [entry, value, depends?.trim() || '—', sources]);
  } else {
    if (before.includes(value)) return { path: rel, entry: value, duplicate: true };
    entry = `- ${value}${sources ? ` (${sources})` : ''}`;
    after = appendToSection(before, HEADINGS[as], entry);
  }
  if (!dryRun) fs.writeFileSync(full, after);
  return { path: rel, entry, duplicate: false };
}
