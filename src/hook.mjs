// `dejavu hook <event>`: Claude Code hook handlers. Each reads the hook's JSON
// input and returns hook output (or null for no output). Hooks must never break
// a session, so callers swallow errors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { brief } from './brief.mjs';
import { topLevel, workState } from './git.mjs';
import { listHandoffs } from './handoff.mjs';
import { orient, tokenize } from './orient.mjs';
import { isDeclined, loadSession, pruneSessions, saveSession } from './state.mjs';
import { setupStatus } from './setup.mjs';
import { KNOWLEDGE_DIR } from './templates.mjs';

export const EVENTS = ['session-start', 'prompt', 'stop'];
const PROMPT_BUDGET = 800;

export const SETUP_OFFER = `This repository has no Déjà Vu project memory (${KNOWLEDGE_DIR}/) yet. Before starting the user's first request — or right after it, if it is quick — ask once, in your own words: "This repo has no project memory yet. Want me to set it up? I'll draft it from the code and ask you a few questions." If they agree, run \`dejavu setup\` and follow its instructions. If they decline, run \`dejavu setup --decline\` so you do not ask again in this repository. If \`dejavu\` is not on PATH, use \`npx dejavu-memory\`.`;

const STOP_NOTE = `Déjà Vu: files changed in this session and no handoff has been recorded. If the task is finished or paused, record one (\`dejavu handoff --task "..." --tests "..." --next "..."\`), and if you learned something durable that project memory lacks, ask the user whether to remember it. If the work is still in progress, ignore this note.`;

const output = (hookEventName, additionalContext) => ({ hookSpecificOutput: { hookEventName, additionalContext } });

function repoRoot(input) {
  const root = topLevel(input.cwd || process.cwd());
  if (!root || path.resolve(root) === path.resolve(os.homedir())) return null;
  return path.resolve(root);
}

// Memory files and the pointers setup creates are not task work.
const memoryOnly = (line) => line.slice(3).startsWith(`${KNOWLEDGE_DIR}/`) || /^\?\? (AGENTS|CLAUDE)\.md$/.test(line);

const hasKnowledge = (root) => fs.existsSync(path.join(root, KNOWLEDGE_DIR));

function sessionStart(input, env, now) {
  const root = repoRoot(input);
  if (!root) return null;
  pruneSessions(env);
  const previous = loadSession(input.session_id, env);
  saveSession(input.session_id, {
    root, started: previous?.started ?? now.toISOString(), work: previous?.work ?? workState(root, memoryOnly),
    sent: [], nudged: previous?.nudged ?? false,
  }, env);
  if (setupStatus(root).state === 'missing') return isDeclined(root, env) ? null : output('SessionStart', SETUP_OFFER);
  return output('SessionStart', brief(root));
}

function prompt(input, env, now) {
  const root = repoRoot(input);
  const text = (input.prompt ?? '').trim();
  if (!root || !hasKnowledge(root) || text.startsWith('/') || tokenize(text).length < 2) return null;
  const session = loadSession(input.session_id, env) ?? { root, started: now.toISOString(), work: workState(root, memoryOnly), sent: [], nudged: false };
  const result = orient(root, text, { budget: PROMPT_BUDGET, exclude: new Set(session.sent) });
  if (!result.selected.length) {
    saveSession(input.session_id, session, env);
    return null;
  }
  session.sent = [...session.sent, ...result.selected.map((s) => `${s.path}:${s.line}`)];
  saveSession(input.session_id, session, env);
  const blocks = result.selected.map((s) => s.block).join('').trimEnd();
  return output('UserPromptSubmit', `Déjà Vu project memory that may be relevant to this request. Verify against the linked source before relying on it.\n\n${blocks}`);
}

function stop(input, env) {
  // Skip while waiting on the user: a turn that closes with questions is not a finished task.
  if (input.stop_hook_active || (input.last_assistant_message ?? '').slice(-400).includes('?')) return null;
  const root = repoRoot(input);
  if (!root || !hasKnowledge(root)) return null;
  const session = loadSession(input.session_id, env);
  if (!session || session.nudged || workState(root, memoryOnly) === session.work) return null;
  if (listHandoffs(root).some((h) => (h.fields.created ?? '') >= session.started)) return null;
  saveSession(input.session_id, { ...session, nudged: true }, env);
  return output('Stop', STOP_NOTE);
}

export function handleHook(event, input = {}, { env = process.env, now = new Date() } = {}) {
  if (event === 'session-start') return sessionStart(input, env, now);
  if (event === 'prompt') return prompt(input, env, now);
  if (event === 'stop') return stop(input, env);
  return null;
}
