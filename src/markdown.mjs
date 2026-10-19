// Small Markdown helpers shared by commands. Not a full parser: enough for
// headings, fences, frontmatter, tables, and list items.

/** Parse simple `key: value` YAML frontmatter. Returns { fields, body, bodyLine } or null fields. */
export function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { fields: null, body: text, bodyLine: 1 };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: text.slice(match[0].length), bodyLine: match[0].split('\n').length };
}

/** Parse a frontmatter list value such as `[]`, `[a, b]`, or `a`. */
export function listValue(value) {
  if (!value) return [];
  return value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Split Markdown into sections at headings, ignoring fenced code.
 * Returns [{ heading, level, line, text }] where line is 1-based in the file.
 */
export function sections(text, { firstLine = 1, fallbackTitle = '' } = {}) {
  const out = [];
  let current = { heading: fallbackTitle, level: 0, line: firstLine, lines: [] };
  let inFence = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      out.push(current);
      current = { heading: heading[2], level: heading[1].length, line: firstLine + i, lines: [] };
    } else {
      current.lines.push(line);
    }
  });
  out.push(current);
  return out
    .map(({ lines, ...s }) => ({ ...s, text: lines.join('\n').trim() }))
    .filter((s) => s.text || s.level > 0);
}

/** Rows of the first Markdown table: { header, rows: [{ cells, line }], end } (end = index after last row), or null. */
export function firstTable(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*\|/.test(l));
  if (start < 0) return null;
  const split = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = split(lines[start]);
  const rows = [];
  let i = start + 1;
  for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    const cells = split(lines[i]);
    if (cells.every((c) => /^:?-+:?$/.test(c)) || cells.every((c) => !c)) continue;
    rows.push({ cells, line: i + 1 });
  }
  return { header, rows, end: i };
}

/** List items under each `## Heading`: { [lowercased heading]: [{ text, line }] }. */
export function sectionItems(text) {
  const out = {};
  let current = null;
  let inFence = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const heading = /^#{2,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1].toLowerCase();
      out[current] ??= [];
      return;
    }
    const item = current && /^\s*[-*]\s+(.+)$/.exec(line);
    if (item) out[current].push({ text: item[1], line: i + 1 });
  });
  return out;
}
