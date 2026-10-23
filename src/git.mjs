// Minimal, failure-tolerant Git queries. Every helper returns null or []
// outside a repository instead of throwing.
import { spawnSync } from 'node:child_process';

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trimEnd() : null;
}

export const isRepo = (root) => git(root, ['rev-parse', '--is-inside-work-tree']) === 'true';

export function currentBranch(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return branch && branch !== 'HEAD' ? branch : null;
}

export function defaultBase(root) {
  const remoteHead = git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteHead) return remoteHead;
  for (const name of ['main', 'master']) {
    if (git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  return null;
}

/** Files changed on this branch since `base`, plus uncommitted changes, sorted and unique. */
export function changedFiles(root, base) {
  const files = new Set();
  if (base) {
    const mergeBase = git(root, ['merge-base', 'HEAD', base]);
    const committed = mergeBase && git(root, ['diff', '--name-only', `${mergeBase}..HEAD`]);
    for (const f of committed ? committed.split('\n') : []) if (f) files.add(f);
  }
  const status = git(root, ['status', '--porcelain=v1', '-uall']);
  for (const line of status ? status.split('\n') : []) {
    const file = line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, '');
    if (file) files.add(file);
  }
  return [...files].sort();
}

/** Files changed between `ref` and the working tree; null if `ref` is unknown. */
export function changedSince(root, ref) {
  if (!git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return null;
  const out = git(root, ['diff', '--name-only', ref]);
  return out ? out.split('\n').filter(Boolean).sort() : [];
}

export const headCommit = (root) => git(root, ['rev-parse', '--short', 'HEAD']);

/** Absolute path of the repository's top-level directory, or null outside Git. */
export const topLevel = (dir) => git(dir, ['rev-parse', '--show-toplevel']);

/** A string that changes whenever HEAD or the working tree changes, ignoring paths that `ignore(line)` matches. */
export function workState(root, ignore = () => false) {
  return `${git(root, ['rev-parse', 'HEAD']) ?? ''}\n${uncommitted(root, ignore).join('\n')}`;
}

export const branchExists = (root, branch) => git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null;

export const mergeBase = (root, a, b) => git(root, ['merge-base', a, b]);

export const isAncestor = (root, a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: root }).status === 0;

/** Uncommitted paths (porcelain lines) that `ignore(line)` does not match. */
export function uncommitted(root, ignore = () => false) {
  return (git(root, ['status', '--porcelain=v1', '-uall']) ?? '').split('\n').filter((line) => line && !ignore(line));
}
