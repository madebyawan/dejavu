// `dejavu brief`: a short summary of the knowledge layer for the start of a
// session — terms, components, known facts, accepted lessons, this branch's handoff,
// setup progress, and how to grow memory. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { resume } from './handoff.mjs';
import { loadLessons } from './lessons.mjs';
import { hasCodeGraph } from './discover.mjs';
import { firstTable, listValue, sectionItems } from './markdown.mjs';
import { SETUP_FILE, setupStatus } from './setup.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const BRIEF_CHARS = 6000;
const ITEM_CHARS = 180;

const read = (root, rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return '';
  }
};

const clip = (s, n = ITEM_CHARS) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const plain = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();

export const MEMORY_PROTOCOL = `## Growing memory

When you learn something durable that this memory does not have — the maintainer corrects you, states a decision, preference, constraint, or fact, or you find a bug's root cause — ask in one short line, e.g. "Should I remember that …?" Only if they agree, record it:

- Facts, terms, components: \`dejavu remember "<text>" --as known|assumption|question|term|component [--name <term>] --source <file|commit|#issue|URL|maintainer>\`
- Lessons from a concrete bug or review: \`dejavu learn ...\` (a proposal; only the maintainer accepts it)

Ask at a natural pause, not mid-task, and at most a couple of times per session. Never record secrets. If you pause unfinished work, record a handoff for the branch with \`dejavu handoff --task ... --tests ... --next ...\`.`;

/** Lines for a list section, stopping before the character budget runs out. */
function fit(label, items, room) {
  if (!items.length) return '';
  let out = `${label}:`;
  let shown = 0;
  for (const item of items) {
    const next = `\n- ${clip(plain(item))}`;
    if (out.length + next.length > room) break;
    out += next;
    shown++;
  }
  if (shown < items.length) out += `\n- …and ${items.length - shown} more in ${KNOWLEDGE_DIR}/`;
  return shown ? out : '';
}

export function setupNote(status) {
  if (status.state === 'unchecked') {
    return `## Setup\n\nThis repository has ${KNOWLEDGE_DIR}/ but has not been through \`dejavu setup\`. When the user's current request allows, offer to run it: it lists what memory is missing and you then fill the gaps with the maintainer.`;
  }
  if (status.state === 'open') {
    return `## Setup\n\n${status.open.length} setup item(s) still open in ${SETUP_FILE}: ${status.open.join(', ')}. When the user's current request allows (or now, if they ask about setup), draft what you can from the code and ask the maintainer about the rest, two or three questions at a time. Do not hold up their task for it.`;
  }
  return '';
}

export function brief(root, { maxChars = BRIEF_CHARS } = {}) {
  const ontology = firstTable(read(root, `${KNOWLEDGE_DIR}/ontology.md`))?.rows ?? [];
  const topology = firstTable(read(root, `${KNOWLEDGE_DIR}/topology.md`))?.rows ?? [];
  const epi = sectionItems(read(root, `${KNOWLEDGE_DIR}/epistemology.md`));
  const lessons = loadLessons(root);
  const accepted = lessons.filter((l) => l.fields.id?.startsWith('W-') && l.fields.status === 'accepted' && !listValue(l.fields.superseded_by).length);
  const pending = lessons.filter((l) => l.fields.status === 'proposed');
  const { handoff } = resume(root);
  const status = setupStatus(root);
  const graph = hasCodeGraph(root);

  const head = `# Déjà Vu project memory\n\nThis repository keeps reviewed project memory in ${KNOWLEDGE_DIR}/ (start at ${KNOWLEDGE_DIR}/README.md and ${KNOWLEDGE_DIR}/index.md). Code, docs, and the issue tracker stay authoritative; verify time-sensitive claims before relying on them. For task-specific context run \`dejavu orient "<task>"\`.`;
  const tail = [
    graph ? 'Code structure (modules, call paths, where things live) is in the graphify graph: run `graphify query "<question>"`. This memory holds what the code cannot show.' : '',
    pending.length ? `${pending.length} lesson proposal(s) await the maintainer's review; do not treat them as accepted.` : '',
    handoff ? `## Open handoff\n\n${handoff.path}${handoff.fields.branch ? ` (branch \`${handoff.fields.branch}\`)` : ''}: ${handoff.title}. Run \`dejavu resume\` before continuing that work.` : '',
    setupNote(status),
    MEMORY_PROTOCOL,
  ].filter(Boolean).join('\n\n');

  let room = maxChars - head.length - tail.length - 8;
  const parts = [];
  for (const [label, items] of [
    ['Accepted lessons', accepted.map((l) => `${l.fields.id}: ${l.title || l.name}`)],
    ['Known', (epi.known ?? []).map((i) => i.text)],
    ['Terms', ontology.map((r) => `${r.cells[0]} — ${r.cells[1] ?? ''}`)],
    ['Components', graph ? [] : topology.map((r) => `${r.cells[0]} — ${r.cells[1] ?? ''}`)],
    ['Open questions', (epi['open questions'] ?? []).map((i) => i.text)],
  ]) {
    const block = fit(label, items, Math.max(0, Math.min(room, maxChars / 3)));
    if (block) {
      parts.push(block);
      room -= block.length + 2;
    }
  }
  return [head, ...parts, tail].join('\n\n');
}
