// Discover existing documentation and render a link-only index.
import fs from 'node:fs';
import path from 'node:path';

export const DOC_ROOT_CANDIDATES = [
  'adr', 'adrs', 'decisions', 'design', 'doc', 'docs', 'documentation',
  'rfc', 'rfcs', 'spec', 'specs', 'wiki',
];

// Hidden folders that hold authoritative project rules (Spec Kit's constitution).
export const HIDDEN_DOC_ROOTS = ['.specify/memory'];

const MAX_DEPTH = 4;
const MAX_PER_ROOT = 100; // larger roots are summarized by subfolder
const MAX_PER_GROUP = 20;
export const GRAPHIFY_GRAPH = 'graphify-out/graph.json';
const SKIP_DIRS = new Set(['node_modules', '.git', '.dejavu', 'graphify-out']);

/**
 * True when the repository has a graphify code graph. Agents then query code
 * structure on demand, so Déjà Vu stops pushing it and keeps to what code cannot show.
 */
export const hasCodeGraph = (root) => fs.existsSync(path.join(root, GRAPHIFY_GRAPH));

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Sort a folder's README before its siblings so indexes read top-down.
const readmeFirst = (p) => p.replace(/(^|\/)readme\.(md|markdown|mdx)$/i, '$1\u0000');
const byIndexOrder = (a, b) => byPath(readmeFirst(a), readmeFirst(b));
const isMarkdown = (name) => /\.(md|markdown|mdx)$/i.test(name);
const toPosix = (p) => p.split(path.sep).join('/');

function listMarkdown(root, rel, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => byPath(a.name, b.name))) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH && !entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) {
        listMarkdown(root, child, depth + 1, out);
      }
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      out.push(child);
    }
  }
}

function titleOf(text, rel) {
  const match = /^#\s+(.+?)\s*#*\s*$/m.exec(text ?? '');
  return match ? match[1] : path.posix.basename(rel);
}

/**
 * Discover documentation under `root`.
 * `planned` maps relative paths to contents of files that init is about to
 * create, so dry runs and structured mode index what will exist.
 * Returns { entryPoints: [{path,title}], roots: [{root, files, omitted}] }.
 */
export function discover(root, { extraRoots = [], planned = new Map(), entryPointsOnly = false } = {}) {
  const read = (rel) => {
    if (planned.has(rel)) return planned.get(rel);
    try {
      return fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      return '';
    }
  };
  const describe = (rel) => ({ path: rel, title: titleOf(read(rel), rel) });

  const topLevel = new Set();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && isMarkdown(entry.name)) topLevel.add(entry.name);
  }
  for (const rel of planned.keys()) {
    if (!rel.includes('/') && isMarkdown(rel)) topLevel.add(rel);
  }
  const entryPoints = [...topLevel].sort(byPath).map(describe);
  if (entryPointsOnly) return { entryPoints, roots: [] };

  const rootNames = new Set(extraRoots.map((r) => toPosix(r).replace(/^\.\/|\/+$/g, '')));
  for (const name of [...DOC_ROOT_CANDIDATES, ...HIDDEN_DOC_ROOTS]) {
    const plannedHere = [...planned.keys()].some((rel) => rel.startsWith(`${name}/`));
    let isDir = false;
    try {
      isDir = fs.statSync(path.join(root, name)).isDirectory();
    } catch {}
    if (isDir || plannedHere) rootNames.add(name);
  }

  const roots = [];
  const seen = new Set(entryPoints.map((e) => e.path));
  for (const name of [...rootNames].sort(byPath)) {
    const files = [];
    const full = path.join(root, name);
    const isFile = fs.existsSync(full) && fs.statSync(full).isFile();
    if (isFile) {
      files.push(name);
    } else {
      listMarkdown(root, name, 1, files);
      for (const rel of planned.keys()) {
        if (rel.startsWith(`${name}/`) && !files.includes(rel)) files.push(rel);
      }
    }
    const unique = files.filter((f) => !seen.has(f)).sort(byIndexOrder);
    unique.forEach((f) => seen.add(f));
    if (unique.length === 0) continue;
    roots.push({
      root: name,
      heading: isFile ? name : `${name}/`,
      files: unique.map(describe),
    });
  }
  return { entryPoints, roots };
}

const encodeSegment = (s) => encodeURIComponent(s).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const link = (rel) => `../${rel.split('/').map(encodeSegment).join('/')}`;
const escapeText = (s) => s.replace(/[[\]\\]/g, '\\$&');
const item = ({ path: rel, title }) =>
  title === path.posix.basename(rel)
    ? `- [${escapeText(rel)}](${link(rel)})`
    : `- [${escapeText(title)}](${link(rel)}) — \`${rel}\``;

export function renderIndex({ entryPoints, roots }, { mode }) {
  const lines = [
    '# Project index',
    '',
    'Links to the authoritative documentation in this repository. Déjà Vu links to these files; it does not copy them.',
    '',
    `Generated by \`dejavu init --mode ${mode}\`. Edit freely: reruns leave this file unchanged. To regenerate it, move this file aside and rerun init.`,
    '',
    '## Entry points',
    '',
    ...(entryPoints.length ? entryPoints.map(item) : ['_No top-level Markdown files found._']),
    '',
  ];
  if (mode === 'minimal') {
    lines.push('## Documentation', '', 'Not indexed in minimal mode. Add links here, or use `--mode adopt-existing` to discover documentation folders.', '');
  } else if (roots.length === 0) {
    lines.push('## Documentation', '', '_No documentation folders found._', '');
  }
  for (const { root, heading, files } of roots) {
    lines.push(`## ${heading}`, '', ...renderRoot(root, files), '');
  }
  return lines.join('\n');
}

const plural = (n) => `${n} Markdown file${n === 1 ? '' : 's'}`;

// Group files by the first path segment below `prefix`; files directly in it use ''.
function groupBy(files, prefix) {
  const groups = new Map();
  for (const f of files) {
    const rest = f.path.slice(prefix.length + 1);
    const key = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups].sort(([a], [b]) => byPath(a, b));
}

/** List every file in small roots; summarize large subfolders so the index stays navigable. */
function renderRoot(root, files) {
  if (files.length <= MAX_PER_ROOT) return files.map(item);
  const lines = [];
  for (const [sub, group] of groupBy(files, root)) {
    if (!sub) {
      lines.push(...group.map(item));
      continue;
    }
    const dir = `${root}/${sub}`;
    if (group.length <= MAX_PER_GROUP) {
      lines.push('', `### ${dir}/`, '', ...group.map(item));
      continue;
    }
    const readme = group.find((f) => /^readme\.(md|markdown|mdx)$/i.test(f.path.slice(dir.length + 1)));
    const parts = groupBy(group, dir).map(([name, g]) => (name ? `\`${name}/\` (${g.length})` : `${g.length} directly`));
    lines.push('', `### ${dir}/`, '');
    if (readme) lines.push(item(readme));
    lines.push(`- [${escapeText(`${dir}/`)}](${link(dir)}/) — ${plural(group.length)}: ${parts.join(', ')}. Search with \`dejavu orient\` or open the folder.`);
  }
  return lines;
}
