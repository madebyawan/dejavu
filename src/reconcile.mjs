// `dejavu reconcile`: review lessons. The report is read-only; accept, reject,
// and supersede change lesson files only when a named maintainer asks.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { localLinks } from './check.mjs';
import { findSecret } from './handoff.mjs';
import { CONFIDENCE, LessonError, WISDOM_DIR, loadLessons, nextId, setFields, today } from './lessons.mjs';
import { tokenize } from './orient.mjs';

const STATUSES = { proposals: ['proposed', 'accepted', 'rejected'], wisdom: ['accepted', 'superseded'] };
const PREFIX = { proposals: 'P', wisdom: 'W' };
const NEGATION = /\b(never|not|no|don't|do not|avoid|stop|without)\b/i;
const SIMILARITY = 0.5;

function jaccard(a, b) {
  const x = new Set(a);
  const y = new Set(b);
  const inter = [...x].filter((t) => y.has(t)).length;
  return inter / (new Set([...x, ...y]).size || 1);
}

function lastCommitDate(root, file) {
  const r = spawnSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

// Evidence is a list of references, or a prose paragraph if there are no list items.
function evidenceItems(lesson) {
  const text = lesson.sections.evidence?.text ?? '';
  const items = text.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l));
  return items.length ? items : text.trim() ? [text.trim()] : [];
}

/** Read-only review of proposals and wisdom. */
export function report(root) {
  const errors = [];
  const warnings = [];
  const lessons = loadLessons(root);
  const byId = new Map();

  for (const l of lessons) {
    const where = `${l.path}`;
    if (!l.hasFrontmatter) {
      errors.push(`${where}: missing frontmatter (id, status, confidence, supersedes, superseded_by).`);
      continue;
    }
    const { id, status, confidence } = l.fields;
    if (!id) errors.push(`${where}: missing id.`);
    else if (!new RegExp(`^${PREFIX[l.where]}-\\d{4,}$`).test(id)) errors.push(`${where}: id ${id} should look like ${PREFIX[l.where]}-0001 in ${l.where}/.`);
    else if (!l.name.startsWith(id)) warnings.push(`${where}: file name does not start with its id ${id}.`);
    if (id && byId.has(id)) errors.push(`${where}: duplicate id ${id} (also ${byId.get(id).path}).`);
    if (id) byId.set(id, l);
    if (!STATUSES[l.where].includes(status)) errors.push(`${where}: status "${status ?? ''}" is not valid in ${l.where}/ (expected ${STATUSES[l.where].join(', ')}).`);
    if (!CONFIDENCE.includes(confidence)) errors.push(`${where}: confidence "${confidence ?? ''}" should be one of ${CONFIDENCE.join(', ')}.`);
    if (['proposed', 'accepted'].includes(status) && !evidenceItems(l).length) errors.push(`${where}: no items under "## Evidence"; every lesson needs evidence.`);

    for (const { line, target } of localLinks(l.text)) {
      if (!fs.existsSync(path.resolve(path.dirname(path.join(root, l.path)), target))) {
        errors.push(`${where}:${line}: broken evidence link to ${target}.`);
      }
    }
  }

  for (const l of lessons) {
    const id = l.fields.id;
    if (!id) continue;
    for (const ref of [...l.supersedes, ...l.supersededBy, ...(l.fields.accepted_as ? [l.fields.accepted_as] : [])]) {
      if (!byId.has(ref)) errors.push(`${l.path}: references ${ref}, which does not exist.`);
    }
    if (l.where === 'proposals' && l.fields.status === 'accepted' && !l.fields.accepted_as) {
      errors.push(`${l.path}: accepted proposal has no accepted_as pointing to its wisdom entry.`);
    }
    if (l.where !== 'wisdom') continue;
    if (l.supersededBy.length && l.fields.status !== 'superseded') {
      warnings.push(`${l.path}: has superseded_by but status is "${l.fields.status}"; set status: superseded.`);
    }
    for (const newer of l.supersededBy) {
      const other = byId.get(newer);
      if (other && !other.supersedes.includes(id)) warnings.push(`${l.path}: superseded_by ${newer}, but ${newer} does not list ${id} in supersedes.`);
      if (other?.supersededBy.includes(id)) errors.push(`${l.path}: ${id} and ${newer} supersede each other.`);
    }
    for (const older of l.supersedes) {
      const other = byId.get(older);
      if (other?.where === 'wisdom' && !other.supersededBy.includes(id)) {
        warnings.push(`${other.path}: ${id} supersedes it, but it does not record superseded_by ${id}. Run \`dejavu reconcile supersede ${older} --with ${id} --by <name>\`.`);
      }
    }
    // Stale evidence: local files changed after the lesson was accepted.
    const since = l.fields.accepted ?? l.fields.created;
    if (l.fields.status === 'accepted' && since) {
      for (const { target } of localLinks(l.sections.evidence?.text ?? '')) {
        const file = path.relative(root, path.resolve(path.dirname(path.join(root, l.path)), target)).split(path.sep).join('/');
        const changed = fs.existsSync(path.join(root, file)) && lastCommitDate(root, file);
        if (changed && changed > since) warnings.push(`${l.path}: evidence ${file} changed on ${changed}, after ${since}; re-verify the lesson.`);
      }
    }
  }

  // Similar titles: possible duplicates, contradictions, or supersession candidates.
  const accepted = lessons.filter((l) => l.where === 'wisdom' && l.fields.status === 'accepted');
  const pending = lessons.filter((l) => l.where === 'proposals' && l.fields.status === 'proposed');
  const tokens = new Map(lessons.map((l) => [l, tokenize(l.title)]));
  for (let i = 0; i < accepted.length; i++) {
    for (let j = i + 1; j < accepted.length; j++) {
      const [a, b] = [accepted[i], accepted[j]];
      if (jaccard(tokens.get(a), tokens.get(b)) < SIMILARITY) continue;
      const kind = NEGATION.test(a.title) !== NEGATION.test(b.title) ? 'possible contradiction' : 'possible duplicate';
      warnings.push(`${kind}: ${a.fields.id} "${a.title}" and ${b.fields.id} "${b.title}". Supersede one or reword them.`);
    }
  }
  const similar = pending.map((p) => ({
    proposal: p,
    matches: accepted.filter((a) => !p.supersedes.includes(a.fields.id) && jaccard(tokens.get(p), tokens.get(a)) >= SIMILARITY).map((a) => a.fields.id),
  }));

  return {
    errors, warnings, lessons: lessons.length,
    pending: similar.map(({ proposal: p, matches }) => ({
      id: p.fields.id, path: p.path, title: p.title, confidence: p.fields.confidence, created: p.fields.created,
      evidence: evidenceItems(p).length, supersedes: p.supersedes, similar: matches,
    })),
  };
}

function requireReviewer(by) {
  if (!by?.trim()) throw new LessonError('--by <name> is required: canonical knowledge changes need a named human reviewer.');
  if (findSecret(by)) throw new LessonError('--by looks like a secret.');
  return by.trim();
}

function find(root, id) {
  const lessons = loadLessons(root);
  const lesson = lessons.find((l) => l.fields.id === id);
  if (!lesson) throw new LessonError(`no lesson with id ${id}.`);
  return { lessons, lesson };
}

const write = (root, changes, dryRun) => {
  if (dryRun) return;
  for (const c of changes) {
    if (c.create) fs.writeFileSync(path.join(root, c.path), c.contents, { flag: 'wx' });
    else fs.writeFileSync(path.join(root, c.path), c.contents);
  }
};

/** Promote a proposal into wisdom. The proposal stays as history with accepted_as. */
export function accept(root, id, { by, now, dryRun = false } = {}) {
  const reviewer = requireReviewer(by);
  const { lessons, lesson } = find(root, id);
  if (lesson.where !== 'proposals') throw new LessonError(`${id} is not a proposal.`);
  if (lesson.fields.status !== 'proposed') throw new LessonError(`${id} has status "${lesson.fields.status}"; only proposed lessons can be accepted.`);
  if (!evidenceItems(lesson).length) throw new LessonError(`${id} has no evidence; add some before accepting.`);
  const date = today(now);
  const wid = nextId(lessons, 'W');
  const slug = lesson.name.replace(/^P-\d+-?/, '').replace(/\.md$/i, '') || 'lesson';
  const wisdomPath = `${WISDOM_DIR}/${wid}-${slug}.md`;
  const changes = [{
    path: wisdomPath, create: true, action: 'create',
    contents: setFields(lesson.text, { id: wid, status: 'accepted', proposal: id, accepted: date, accepted_by: reviewer }),
  }, {
    path: lesson.path, action: 'update',
    contents: setFields(lesson.text, { status: 'accepted', accepted_as: wid }),
  }];
  for (const old of lesson.supersedes) {
    const target = lessons.find((l) => l.fields.id === old && l.where === 'wisdom');
    if (!target) throw new LessonError(`${id} supersedes ${old}, which is not in wisdom/.`);
    changes.push({
      path: target.path, action: 'update',
      contents: setFields(target.text, { status: 'superseded', superseded_by: [...new Set([...target.supersededBy, wid])], superseded_on: date }),
    });
  }
  if (!dryRun) fs.mkdirSync(path.join(root, WISDOM_DIR), { recursive: true });
  write(root, changes, dryRun);
  return { id: wid, changes };
}

export function reject(root, id, { by, reason, now, dryRun = false } = {}) {
  const reviewer = requireReviewer(by);
  if (!reason?.trim()) throw new LessonError('--reason is required so the decision is recorded.');
  if (findSecret(reason)) throw new LessonError('--reason looks like it contains a secret.');
  const { lesson } = find(root, id);
  if (lesson.where !== 'proposals' || lesson.fields.status !== 'proposed') throw new LessonError(`${id} is not a pending proposal.`);
  const changes = [{
    path: lesson.path, action: 'update',
    contents: setFields(lesson.text, { status: 'rejected', rejected_by: reviewer, rejected_on: today(now), reason: reason.trim().replace(/\s+/g, ' ') }),
  }];
  write(root, changes, dryRun);
  return { changes };
}

export function supersede(root, oldId, newId, { by, now, dryRun = false } = {}) {
  const reviewer = requireReviewer(by);
  if (oldId === newId) throw new LessonError('a lesson cannot supersede itself.');
  const lessons = loadLessons(root);
  const get = (id) => {
    const l = lessons.find((x) => x.fields.id === id && x.where === 'wisdom');
    if (!l) throw new LessonError(`${id} is not in wisdom/.`);
    return l;
  };
  const older = get(oldId);
  const newer = get(newId);
  if (newer.fields.status !== 'accepted') throw new LessonError(`${newId} has status "${newer.fields.status}"; the replacement must be accepted.`);
  if (newer.supersededBy.includes(oldId)) throw new LessonError(`${newId} is already superseded by ${oldId}.`);
  const date = today(now);
  const changes = [
    { path: older.path, action: 'update', contents: setFields(older.text, { status: 'superseded', superseded_by: [...new Set([...older.supersededBy, newId])], superseded_on: date, superseded_by_reviewer: reviewer }) },
    { path: newer.path, action: 'update', contents: setFields(newer.text, { supersedes: [...new Set([...newer.supersedes, oldId])] }) },
  ];
  write(root, changes, dryRun);
  return { changes };
}

