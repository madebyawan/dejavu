// `dejavu learn`: record an evidence-backed lesson as a proposal. Proposals
// are never promoted automatically; see `dejavu reconcile accept`.
import fs from 'node:fs';
import path from 'node:path';
import { findSecret } from './handoff.mjs';
import { CONFIDENCE, LessonError, PROPOSALS_DIR, loadLessons, nextId, parseEvidence, slugify, today } from './lessons.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const MAX_LESSON_FIELD_CHARS = 1000;

export function renderProposal({ id, date, confidence, supersedes, summary, context, cause, evidence, prevention }) {
  return [
    '---',
    `id: ${id}`,
    'status: proposed',
    `confidence: ${confidence}`,
    `created: ${date}`,
    `supersedes: [${supersedes.join(', ')}]`,
    'superseded_by: []',
    '---',
    '',
    `# ${summary}`,
    '',
    '## Context', '', context, '',
    '## Cause', '', cause, '',
    '## Evidence', '', ...evidence.map((e) => `- ${e.markdown}`), '',
    '## Prevention', '', prevention, '',
  ].join('\n');
}

export function learn(root, options) {
  const { summary, context, cause, prevention, evidence = [], confidence = 'medium', supersedes = [], now, dryRun = false } = options;
  if (!fs.existsSync(path.join(root, KNOWLEDGE_DIR))) throw new LessonError(`${KNOWLEDGE_DIR}/ not found. Run \`dejavu init\` first.`);

  const required = { summary, context, cause, prevention };
  for (const [name, value] of Object.entries(required)) {
    if (!value?.trim()) throw new LessonError(`--${name} is required: a lesson needs a summary, context, cause, and prevention step.`);
  }
  if (!evidence.length) throw new LessonError('at least one --evidence is required (a bug, review, test, PR, commit, or file). Lessons without evidence stay as notes, not proposals.');
  if (!CONFIDENCE.includes(confidence)) throw new LessonError(`--confidence must be one of ${CONFIDENCE.join(', ')}.`);
  for (const [name, value] of Object.entries({ ...required, evidence: evidence.join('\n') })) {
    if (value.length > MAX_LESSON_FIELD_CHARS) throw new LessonError(`--${name} is ${value.length} characters (max ${MAX_LESSON_FIELD_CHARS}). Summarize; link to the source instead of pasting it.`);
    const secret = findSecret(value);
    if (secret) throw new LessonError(`--${name} looks like it contains a ${secret}. Remove it.`);
  }

  const lessons = loadLessons(root);
  const known = new Set(lessons.map((l) => l.fields.id).filter(Boolean));
  for (const ref of supersedes) {
    if (!/^W-\d+$/.test(ref)) throw new LessonError(`--supersedes must reference an accepted lesson ID such as W-0003: ${ref}`);
    if (!known.has(ref)) throw new LessonError(`--supersedes ${ref}: no lesson with that ID in ${KNOWLEDGE_DIR}/wisdom/.`);
  }

  const parsed = evidence.map((e) => parseEvidence(root, e, PROPOSALS_DIR));
  const id = nextId(lessons, 'P');
  const rel = `${PROPOSALS_DIR}/${id}-${slugify(summary)}.md`;
  const contents = renderProposal({
    id, date: today(now), confidence, supersedes, evidence: parsed,
    summary: summary.trim().replace(/\s+/g, ' '), context: context.trim(), cause: cause.trim(), prevention: prevention.trim(),
  });
  if (!dryRun) {
    fs.mkdirSync(path.join(root, PROPOSALS_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, rel), contents, { flag: 'wx' });
  }
  return { id, path: rel, contents };
}
