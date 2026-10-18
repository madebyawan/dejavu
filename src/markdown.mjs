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
