// Per-user state that must not live in the repository: repositories where the
// maintainer declined setup, and short-lived per-session hook bookkeeping.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function stateDir(env = process.env) {
  return env.DEJAVU_STATE_DIR || env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.config', 'dejavu');
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const declinedFile = (env) => path.join(stateDir(env), 'declined.json');

export const isDeclined = (root, env) => Boolean(readJson(declinedFile(env), {})[root]);

export function setDeclined(root, declined, env, now = new Date()) {
  const all = readJson(declinedFile(env), {});
  if (declined) all[root] = now.toISOString().slice(0, 10);
  else delete all[root];
  writeJson(declinedFile(env), all);
}

const sessionFile = (id, env) => path.join(stateDir(env), 'sessions', `${String(id).replace(/[^\w-]/g, '_')}.json`);

export const loadSession = (id, env) => (id ? readJson(sessionFile(id, env), null) : null);

export function saveSession(id, value, env) {
  if (id) writeJson(sessionFile(id, env), value);
}

/** Remove session files older than a week. */
export function pruneSessions(env, now = Date.now()) {
  const dir = path.join(stateDir(env), 'sessions');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (now - fs.statSync(file).mtimeMs > SESSION_TTL_MS) fs.rmSync(file, { force: true });
  }
}
