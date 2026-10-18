// `dejavu check`: validate the installed scaffold and its local links.
import fs from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE_DIR } from './templates.mjs';
import { SKILL_TARGETS } from './init.mjs';

const REQUIRED = [
  ['README.md', 'file'],
  ['index.md', 'file'],
  ['ontology.md', 'file'],
  ['topology.md', 'file'],
  ['epistemology.md', 'file'],
  ['wisdom', 'dir'],
  ['proposals', 'dir'],
  ['handoffs', 'dir'],
].map(([rel, kind]) => [`${KNOWLEDGE_DIR}/${rel}`, kind]);

const AGENT_FILES = ['AGENTS.md', 'CLAUDE.md'];

function markdownFiles(root, rel, out = []) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) markdownFiles(root, child, out);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) out.push(child);
  }
  return out.sort();
}

/** Yield { line, target } for inline Markdown links outside code. */
export function* localLinks(text) {
  let inFence = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const line = lines[i].replace(/`[^`]*`/g, '');
    for (const match of line.matchAll(/!?\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      let target = match[1].replace(/^<|>$/g, '');
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('//')) continue;
      target = target.replace(/[#?].*$/, '');
      if (!target) continue;
      try {
        target = decodeURIComponent(target);
      } catch {}
      yield { line: i + 1, target };
    }
  }
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

export function check(root) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) {
    errors.push(`${KNOWLEDGE_DIR}/ not found. Run \`dejavu init\` to create it.`);
    return { errors, warnings, checked: 0 };
  }

  for (const [rel, kind] of REQUIRED) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      errors.push(`missing ${kind === 'dir' ? 'directory' : 'file'} ${rel}. Run \`dejavu init\` to restore it (existing files are kept).`);
    } else if (kind === 'dir' && !fs.statSync(full).isDirectory()) {
      errors.push(`${rel} should be a directory.`);
    } else if (kind === 'file' && !fs.statSync(full).isFile()) {
      errors.push(`${rel} should be a file.`);
    }
  }

  const toScan = markdownFiles(root, KNOWLEDGE_DIR);
  for (const rel of AGENT_FILES) if (fs.existsSync(path.join(root, rel))) toScan.push(rel);

  for (const rel of toScan) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const { line, target } of localLinks(text)) {
      const resolved = path.resolve(path.dirname(path.join(root, rel)), target);
      if (!fs.existsSync(resolved)) {
        errors.push(`${rel}:${line}: broken link to ${target}. Fix the path or remove the link.`);
      }
    }
  }

  if (fs.existsSync(path.join(root, 'AGENTS.md'))) {
    if (!fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes(KNOWLEDGE_DIR)) {
      warnings.push(`AGENTS.md does not mention ${KNOWLEDGE_DIR}/; agents may not find the knowledge layer.`);
    }
  } else {
    warnings.push(`AGENTS.md not found; agents may not find ${KNOWLEDGE_DIR}/. Run \`dejavu init\` to add a thin pointer.`);
  }

  for (const rel of Object.values(SKILL_TARGETS)) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const fields = frontmatter(fs.readFileSync(full, 'utf8'));
    if (!fields || !fields.name || !fields.description) {
      errors.push(`${rel}: SKILL.md needs YAML frontmatter with name and description.`);
    }
  }

  return { errors, warnings, checked: toScan.length };
}
