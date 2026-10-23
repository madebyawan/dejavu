// `dejavu setup`: create .dejavu/ if needed, find what the knowledge layer is
// missing, and write a checklist an agent works through with the maintainer.
// Never overwrites; the checklist is ticked by hand as items are answered.
import fs from 'node:fs';
import path from 'node:path';
import { discover, hasCodeGraph } from './discover.mjs';
import { init } from './init.mjs';
import { loadLessons, today } from './lessons.mjs';
import { firstTable, sectionItems } from './markdown.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const SETUP_FILE = `${KNOWLEDGE_DIR}/setup.md`;

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return '';
  }
};

const DECISION_PATH = /(^|\/)(adrs?|decisions?|\d+-decisions|rfcs?)(\/|$)|(^|\/)adr[-_]?\d/i;

// [id, title, test(root, found) → true when missing, instruction]
const GAPS = [
  ['overview', 'Overview', (root) => read(root, 'README.md').replace(/\s+/g, ' ').trim().length < 300,
    'Ask: "In a sentence or two, what is this project and who uses it?" Record the answer as a known fact.'],
  ['terms', 'Key terms', (root) => !firstTable(read(root, `${KNOWLEDGE_DIR}/ontology.md`))?.rows.length,
    'Draft 5–10 domain terms from the code and docs, each citing the file that defines it, then ask the maintainer to confirm or correct them. Record with `--as term`.'],
  // A graphify graph already maps the code's structure; spend the questions elsewhere.
  ['components', 'Components', (root) => !hasCodeGraph(root) && !firstTable(read(root, `${KNOWLEDGE_DIR}/topology.md`))?.rows.length,
    'Draft the main modules or services from the code, each citing its folder or entry file, then ask the maintainer to confirm. Record with `--as component`.'],
  ['sources', 'Sources of truth', (root, found) => !found.roots.length,
    'Ask: "Where do plans, specs, and decisions live — a docs folder, the issue tracker, a wiki, or nowhere yet?" Record the answer as a known fact.'],
  ['decisions', 'Past decisions', (root, found) => !found.roots.some((r) => r.files.some((f) => DECISION_PATH.test(f.path))),
    'Ask: "Which past decisions should agents not reopen, and why?" Record each as a known fact.'],
  ['known', 'Things the code does not show', (root) => !(sectionItems(read(root, `${KNOWLEDGE_DIR}/epistemology.md`)).known ?? []).length,
    'Ask: "What is true about this project that is not obvious from the code — environments, constraints, owners, users?" Record as known facts.'],
  ['traps', 'Known traps', (root) => !loadLessons(root).length,
    'Ask: "What breaks easily, or what do agents keep getting wrong here?" Record a concrete bug with evidence via `dejavu learn`; record other answers as known facts.'],
  ['open', 'Open questions', (root) => !(sectionItems(read(root, `${KNOWLEDGE_DIR}/epistemology.md`))['open questions'] ?? []).length,
    'Ask: "What is still undecided?" Record each with `--as question`.'],
  ['rules', 'Agent rules', () => true,
    'Ask: "Is there anything agents must never do here, or must ask before doing — deploys, migrations, files to avoid?" Record as known facts, and suggest adding hard rules to AGENTS.md.'],
];

export function findGaps(root) {
  const found = discover(root);
  return GAPS.filter(([, , missing]) => missing(root, found)).map(([id, title, , how]) => ({ id, title, how }));
}

export function renderChecklist(gaps, { now = new Date() } = {}) {
  const items = gaps.length
    ? gaps.map((g) => `- [ ] **${g.title}** — ${g.how}`).join('\n')
    : '_No gaps found._';
  return `# Déjà Vu setup

Created by \`dejavu setup\` on ${today(now)}. An agent works through this list with the maintainer: draft what the code shows, ask about the rest a few questions at a time, and record answers with \`dejavu remember\` (\`--source maintainer\` for answers given in conversation). Tick an item (\`- [x]\`) when it is answered or the maintainer chooses to skip it. \`dejavu setup\` never overwrites this file.

${items}
`;
}

/** Open (unticked) checklist items, or null when there is no checklist. */
export function openItems(root) {
  const text = read(root, SETUP_FILE);
  if (!text) return null;
  return [...text.matchAll(/^\s*[-*] \[ \] \*\*(.+?)\*\*/gm)].map((m) => m[1]);
}

/** missing: no .dejavu/; unchecked: .dejavu/ without a checklist; open: items remain; done. */
export function setupStatus(root) {
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) return { state: 'missing' };
  const open = openItems(root);
  if (open === null) return { state: 'unchecked' };
  return open.length ? { state: 'open', open } : { state: 'done', open };
}

export function setup(root, { agents = true, dryRun = false, now } = {}) {
  let created = [];
  let mode = null;
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) {
    mode = discover(root).roots.length ? 'adopt-existing' : 'minimal';
    created = init(root, { mode, agents, skills: [], extraRoots: [], dryRun }).results;
  }
  const exists = fs.existsSync(path.join(root, SETUP_FILE));
  const gaps = findGaps(root);
  if (!exists && !dryRun) {
    try {
      fs.writeFileSync(path.join(root, SETUP_FILE), renderChecklist(gaps, { now }), { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  return { mode, created, checklistCreated: !exists, open: exists ? openItems(root) : gaps.map((g) => g.title), gaps };
}
