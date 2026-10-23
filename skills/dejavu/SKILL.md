---
name: dejavu
description: Project memory for coding agents (.dejavu/). Use when a repository has no .dejavu/ yet (offer setup), when setting up or filling gaps in project memory, at the start of a task (brief, orient, resume), when the user corrects you or states a durable fact or decision (ask whether to remember it), when finishing work (handoff), or when capturing a lesson from a bug.
---

# Déjà Vu — project memory

Déjà Vu keeps reviewed project memory as Markdown in `.dejavu/`. Run it as `dejavu <command>`, or `npx dejavu-memory <command>` if `dejavu` is not on PATH. With the Claude Code plugin, hooks do the routine parts automatically: they offer setup, load a brief at session start, add relevant memory to each request, and remind you about a handoff when you stop with uncommitted work.

## Setup

If the repository has no `.dejavu/`, ask the user once whether to set up project memory. If they decline, run `dejavu setup --decline` and do not ask again.

If they agree, or `.dejavu/setup.md` still has open items:

1. Run `dejavu setup`. It creates `.dejavu/` if needed and lists what is missing in `.dejavu/setup.md`.
2. Read the README, docs, and main source folders. Draft what the code shows — key terms and components — each citing its source file, and record them with `dejavu remember`.
3. Ask the maintainer about the rest, two or three questions at a time, in plain language. Do not ask what the code already answers.
4. Record each answer with `dejavu remember "<fact>" --as known --source maintainer`, then tick the item in `.dejavu/setup.md` (`- [x]`). If they skip one, tick it too.
5. Run `dejavu check`, summarize what changed, and suggest committing `.dejavu/`.

If the user is in the middle of other work, finish it first; do not hold up their task for setup.

## Orient

1. Read the repository's instructions (`AGENTS.md`, `CLAUDE.md`) and the task.
2. Use the session brief (`dejavu brief`) and `dejavu orient "<task>"` for ranked, source-linked context. If the brief lists an open handoff for this branch, run `dejavu resume`.
3. Follow source links and verify time-sensitive claims against code, docs, or issues.
4. Distinguish facts, assumptions, and open questions. Proposed lessons are not accepted knowledge.

## Remember as you go

When you learn something durable that memory lacks — the user corrects you, states a decision, preference, constraint, or fact, or you find a bug's root cause — ask in one short line: "Should I remember that …?" Ask at a natural pause, not mid-task, and at most a couple of times per session. Only if they agree:

- Facts: `dejavu remember "<text>" --as known|assumption|question --source <file|commit|#issue|URL|maintainer>`
- Terms and components: `dejavu remember "<meaning>" --as term|component --name "<name>" --source <file>`
- Lessons from a concrete bug, review, or test: `dejavu learn --summary ... --context ... --cause ... --prevention ... --evidence <ref>`. This writes a proposal; never move it into `wisdom/` yourself.

Never record secrets or transcripts.

## Handoff

Only when you pause unfinished work, record task scope, tests run and their results, unresolved questions, and next steps: `dejavu handoff --task "..." --tests "..." --question "..." --next "..."`. Each branch keeps one handoff; recording again replaces it. Skip it for finished work: the commits and PR already say what was done.

## Reconcile

Flag outdated, conflicting, and superseded knowledge. Prefer updating a source of truth and linking to it over copying it into `.dejavu/`. Do not silently overwrite accepted knowledge. Run `dejavu check` after editing `.dejavu/` and `dejavu reconcile` to review lessons. Only a maintainer runs `dejavu reconcile accept|reject|supersede`; never run them unless the maintainer explicitly asks in this session.
