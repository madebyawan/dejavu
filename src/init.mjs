// `dejavu init`: create missing scaffold files. Existing files are never
// modified, moved, or deleted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover, renderIndex } from './discover.mjs';
import {
  AGENTS_HINT, KNOWLEDGE_DIR, agentsPointer, claudePointer, docsFiles, knowledgeFiles,
} from './templates.mjs';

export const MODES = ['minimal', 'structured', 'adopt-existing'];
export const DEFAULT_MODE = 'minimal';
export const SKILL_TARGETS = {
  claude: '.claude/skills/dejavu/SKILL.md',
  codex: '.agents/skills/dejavu/SKILL.md',
};

export const CANONICAL_SKILL = fileURLToPath(new URL('../skills/dejavu/SKILL.md', import.meta.url));

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** Build the ordered list of [relativePath, contents] that init wants to exist. */
export function plan(root, { mode, agents, skills, extraRoots }) {
  const files = [...knowledgeFiles()];
  if (mode === 'structured') files.push(...docsFiles());
  if (agents) {
    files.push(['AGENTS.md', agentsPointer({ structured: mode === 'structured' })]);
    files.push(['CLAUDE.md', claudePointer]);
  }
  if (skills.length) {
    const skill = fs.readFileSync(CANONICAL_SKILL, 'utf8');
    for (const agent of skills) files.push([SKILL_TARGETS[agent], skill]);
  }

  // Index what will exist after this run, without counting files we would skip.
  const planned = new Map(files.filter(([rel]) => !exists(root, rel)));
  const found = discover(root, { extraRoots, planned, entryPointsOnly: mode === 'minimal' });
  files.splice(1, 0, [`${KNOWLEDGE_DIR}/index.md`, renderIndex(found, { mode })]);
  return files;
}

export function init(root, options) {
  const files = plan(root, options);
  const results = [];
  for (const [rel, contents] of files) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) {
      results.push({ path: rel, action: 'exists' });
      continue;
    }
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      try {
        // 'wx' fails instead of overwriting if the file appeared meanwhile.
        fs.writeFileSync(full, contents, { flag: 'wx' });
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        results.push({ path: rel, action: 'exists' });
        continue;
      }
    }
    results.push({ path: rel, action: 'create' });
  }
  return { results, hints: hintsFor(root, results, options) };
}

function hintsFor(root, results, { mode, agents }) {
  const hints = [];
  const kept = new Set(results.filter((r) => r.action === 'exists').map((r) => r.path));
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  if (agents && kept.has('AGENTS.md') && !read('AGENTS.md').includes(KNOWLEDGE_DIR)) {
    hints.push(`AGENTS.md was left unchanged and does not mention ${KNOWLEDGE_DIR}/. Consider adding: "${AGENTS_HINT}"`);
  }
  if (agents && kept.has('CLAUDE.md')) {
    const text = read('CLAUDE.md');
    if (!text.includes('AGENTS.md') && !text.includes(KNOWLEDGE_DIR)) {
      hints.push(`CLAUDE.md was left unchanged and mentions neither AGENTS.md nor ${KNOWLEDGE_DIR}/. Consider adding a line: "@AGENTS.md"`);
    }
  }
  if (kept.has(`${KNOWLEDGE_DIR}/index.md`) && mode !== 'minimal'
    && !read(`${KNOWLEDGE_DIR}/index.md`).includes(`dejavu init --mode ${mode}\``)) {
    hints.push(`${KNOWLEDGE_DIR}/index.md already exists and was not regenerated. Move it aside and rerun to rebuild it from ${mode} discovery.`);
  }
  if (mode === 'structured' && results.some((r) => r.action === 'create' && r.path.startsWith('docs/'))) {
    const existingDocs = fs.existsSync(path.join(root, 'docs'))
      && fs.readdirSync(path.join(root, 'docs')).some((n) => !/^0\d-|^README\.md$/.test(n));
    if (existingDocs) {
      hints.push('docs/ already had other content; it was left in place. For existing repositories, --mode adopt-existing indexes docs without adding folders.');
    }
  }
  return hints;
}
