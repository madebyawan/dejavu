// `dejavu orient`: compile bounded, source-linked context for a task from
// repository docs and accepted .dejavu/ knowledge. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { discover } from './discover.mjs';
import { frontmatter, listValue, sections } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const DEFAULT_BUDGET = 1200; // tokens
export const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'];
const MAX_EXCERPT_CHARS = 900;
const MAX_PER_FILE = 2;
const HEADER_RESERVE_CHARS = 400;

// Rough, deterministic token estimate (about four characters per token).
export const estimateTokens = (text) => Math.ceil(text.length / 4);

const STOPWORDS = new Set(`a an and are as at be but by can do does for from has have how i if in into is it its
of on or our should so that the their them then there these this to use used using was we what when where which
who why will with you your add fix make update change new`.split(/\s+/));

const stem = (w) => w.replace(/(ing|ed|es|s)$/, (m) => (w.length - m.length >= 3 ? '' : m));

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

const EPISTEMIC = { known: 'known', assumptions: 'assumption', 'open questions': 'open question' };

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function docChunks(root, rel) {
  const text = readText(root, rel);
  if (text == null) return [];
  const { body, bodyLine } = frontmatter(text);
  const parts = sections(body, { firstLine: bodyLine, fallbackTitle: path.posix.basename(rel) });
  const title = parts.find((p) => p.level === 1)?.heading;
  // Prefix subsection headings with the document title so "Scope" or "Fix" carry context.
  return parts
    .filter((p) => p.text)
    .map((p) => ({
      path: rel, line: p.line, text: p.text, kind: 'source',
      heading: title && p.level > 1 ? `${title} › ${p.heading}` : p.heading,
    }));
}

function tableRowChunks(root, rel, kind) {
  const text = readText(root, rel);
  if (text == null) return [];
  const rows = [];
  let header = null;
  text.split(/\r?\n/).forEach((line, i) => {
    if (!/^\s*\|/.test(line)) {
      header = null;
      return;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) return;
    if (!header) {
      header = cells;
      return;
    }
    if (cells.every((c) => !c)) return;
    rows.push({
      path: rel, line: i + 1, heading: cells[0],
      text: cells.map((c, j) => `${header[j] ?? ''}: ${c}`).join(' · '), kind,
    });
  });
  return rows;
}

function epistemologyChunks(root) {
  const rel = `${KNOWLEDGE_DIR}/epistemology.md`;
  const text = readText(root, rel);
  if (text == null) return [];
  const out = [];
  for (const s of sections(text)) {
    const kind = EPISTEMIC[s.heading.toLowerCase()];
    if (!kind) continue; // Superseded and unknown sections are not offered as context.
    const lines = text.split(/\r?\n/);
    for (let i = s.line; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
      const item = /^\s*[-*]\s+(.+)$/.exec(lines[i]);
      if (item) out.push({ path: rel, line: i + 1, heading: s.heading, text: item[1], kind });
    }
  }
  return out;
}

function wisdomChunks(root) {
  const dir = path.join(root, KNOWLEDGE_DIR, 'wisdom');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.md$/i.test(name) || /^readme\.md$/i.test(name)) continue;
    const rel = `${KNOWLEDGE_DIR}/wisdom/${name}`;
    const { fields, body, bodyLine } = frontmatter(readText(root, rel) ?? '');
    if (!fields || fields.status !== 'accepted' || listValue(fields.superseded_by).length) continue;
    const parts = sections(body, { firstLine: bodyLine, fallbackTitle: name });
    const title = parts.find((p) => p.level === 1)?.heading ?? name;
    const text = parts.map((p) => (p.level > 1 ? `${p.heading}: ${p.text}` : p.text)).filter(Boolean).join('\n');
    out.push({ path: rel, line: 1, heading: `${fields.id ?? name}: ${title}`, text, kind: 'accepted lesson' });
  }
  return out;
}

/** Gather every candidate chunk plus the total size of the files they came from. */
export function corpus(root) {
  const found = discover(root);
  const docPaths = [...found.entryPoints.map((e) => e.path), ...found.roots.flatMap((r) => r.files.map((f) => f.path))]
    .filter((p) => !INSTRUCTION_FILES.includes(p));
  const knowledgePaths = ['ontology.md', 'topology.md', 'epistemology.md'].map((f) => `${KNOWLEDGE_DIR}/${f}`);
  const chunks = [
    ...docPaths.flatMap((rel) => docChunks(root, rel)),
    ...tableRowChunks(root, knowledgePaths[0], 'knowledge'),
    ...tableRowChunks(root, knowledgePaths[1], 'knowledge'),
    ...epistemologyChunks(root),
    ...wisdomChunks(root),
  ];
  const files = new Set([...docPaths, ...knowledgePaths, ...chunks.map((c) => c.path)]);
  const totalChars = [...files].reduce((n, rel) => n + (readText(root, rel)?.length ?? 0), 0);
  return { chunks, totalChars, fileCount: [...files].filter((rel) => readText(root, rel) != null).length };
}

/** Rank chunks against the task with BM25; headings and paths count double. */
export function rank(chunks, task) {
  const query = [...new Set(tokenize(task))];
  if (!query.length) return [];
  const docs = chunks.map((c) => {
    const tokens = [...tokenize(c.text), ...tokenize(`${c.heading} ${c.path}`).flatMap((t) => [t, t])];
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk: c, tf, length: tokens.length };
  });
  const avg = docs.reduce((n, d) => n + d.length, 0) / (docs.length || 1);
  const df = new Map(query.map((q) => [q, docs.filter((d) => d.tf.has(q)).length]));
  const k1 = 1.2;
  const b = 0.75;
  return docs
    .map(({ chunk, tf, length }) => {
      let score = 0;
      for (const q of query) {
        const f = tf.get(q) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (docs.length - df.get(q) + 0.5) / (df.get(q) + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * length) / avg)));
      }
      if (chunk.kind === 'accepted lesson') score *= 1.25;
      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((x, y) => y.score - x.score || (x.path < y.path ? -1 : x.path > y.path ? 1 : x.line - y.line));
}

function excerpt(text, maxChars) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf('\n');
  return `${(lastBreak > maxChars / 2 ? cut.slice(0, lastBreak) : cut).trimEnd()} …`;
}

// Excerpts are read from the repository root, so rebase relative links.
function rebaseLinks(text, fromPath) {
  return text.replace(/(\]\()([^)\s]+)(\))/g, (all, open, target, close) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) return all;
    return `${open}${path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), target))}${close}`;
  });
}

const quote = (text) => text.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');

export function orient(root, task, { budget = DEFAULT_BUDGET, exclude = new Set() } = {}) {
  const { chunks, totalChars, fileCount } = corpus(root);
  const ranked = rank(chunks, task).filter((c) => !exclude.has(`${c.path}:${c.line}`));
  const maxChars = Math.max(0, budget * 4 - HEADER_RESERVE_CHARS);

  const selected = [];
  const perFile = new Map();
  let used = 0;
  for (const chunk of ranked) {
    // Cap sections per document for variety; knowledge entries are individual facts.
    if (chunk.kind === 'source' && (perFile.get(chunk.path) ?? 0) >= MAX_PER_FILE) continue;
    const head = `### ${selected.length + 1}. ${chunk.heading}\n\n[${chunk.path}:${chunk.line}](${chunk.path}#L${chunk.line}) · ${chunk.kind}\n\n`;
    const room = maxChars - used - head.length - 2;
    if (room < 120) break;
    const body = quote(excerpt(rebaseLinks(chunk.text, chunk.path), Math.min(MAX_EXCERPT_CHARS, room)));
    const block = `${head}${body}\n\n`;
    if (used + block.length > maxChars) break;
    selected.push({ ...chunk, block });
    perFile.set(chunk.path, (perFile.get(chunk.path) ?? 0) + 1);
    used += block.length;
  }

  const instructions = INSTRUCTION_FILES.filter((rel) => fs.existsSync(path.join(root, rel)));
  const result = {
    task, budget, instructions, selected, rankedCount: ranked.length, chunkCount: chunks.length,
    totalChars, fileCount, hasKnowledge: fs.existsSync(path.join(root, KNOWLEDGE_DIR)),
  };
  // Enforce the budget on the rendered output, header included.
  while (selected.length && estimateTokens(renderOrientation(result)) > budget) selected.pop();
  return result;
}

export function renderOrientation(result) {
  const { task, instructions, selected, chunkCount, totalChars, fileCount, hasKnowledge } = result;
  const lines = [`# Orientation: ${task}`, ''];
  const first = [...instructions, ...(hasKnowledge ? [`${KNOWLEDGE_DIR}/index.md`] : [])];
  if (first.length) lines.push(`Read first: ${first.map((rel) => `[${rel}](${rel})`).join(', ')}`, '');
  if (!hasKnowledge) lines.push(`No ${KNOWLEDGE_DIR}/ found; only documentation was searched. Run \`dejavu init\` to add a knowledge layer.`, '');

  if (!selected.length) {
    lines.push(`No sections matched this task across ${fileCount} file(s). Try different words, or browse the files above.`);
    return `${lines.join('\n')}\n`;
  }

  const selectedChars = selected.reduce((n, s) => n + s.block.length, 0);
  const ratio = totalChars ? (100 * selectedChars) / totalChars : 0;
  const pct = ratio < 1 ? ratio.toFixed(1) : Math.round(ratio);
  lines.push(
    `Selected ${selected.length} of ${chunkCount} sections from ${fileCount} file(s): ~${estimateTokens(''.padEnd(selectedChars))} of ~${estimateTokens(''.padEnd(totalChars))} tokens (${pct}%).`,
    'Labels: source = authoritative document; accepted lesson = reviewed wisdom; known / assumption / open question = epistemology; knowledge = index entry to verify against its source. Code and issues remain authoritative.',
    '',
  );
  return `${lines.join('\n')}\n${selected.map((s) => s.block).join('').trimEnd()}\n`;
}
