---
name: dejavu
description: Orient to a repository's Déjà Vu knowledge layer (.dejavu/), record concise session handoffs, and propose evidence-backed lessons for human review. Use when entering an unfamiliar repository, starting or finishing a coding task, or capturing a reusable lesson.
---

# Déjà Vu — portable agent instructions

Use this skill when entering an unfamiliar repository, starting a new task, finishing a coding session, or proposing a reusable lesson.

## Orient

1. Read the repository's authoritative instructions (e.g. `AGENTS.md`, `CLAUDE.md`) and task request.
2. If the `dejavu` CLI is available, run `dejavu orient "<task>"` for ranked, source-linked context. Otherwise read `.dejavu/README.md` and `.dejavu/index.md` and select only task-relevant documentation, ontology, topology, epistemology, and accepted wisdom.
3. Follow source links and verify any time-sensitive claim against code, docs, or issues.
4. Distinguish facts, assumptions, and unresolved questions. Do not treat proposed lessons as accepted.

## Handoff

At the end of a session, record task scope, current branch/PR, changed files, tests run and results, unresolved issues, and concrete next actions in `.dejavu/handoffs/`. With the CLI: `dejavu handoff --task "..." --tests "..." --question "..." --next "..."`. When starting, run `dejavu resume` to pick up the latest open handoff. Do not include secrets or full transcripts.

## Learn

Propose a lesson only when it is supported by a concrete mistake, bug, review, test, or PR. Include evidence and a prevention step. Place it in `.dejavu/proposals/` until reviewed.

## Reconcile

Flag outdated, conflicting, and superseded knowledge. Prefer updating a source of truth and referencing it over copying it into Déjà Vu. Do not silently overwrite accepted knowledge. If the `dejavu` CLI is available, run `dejavu check` after editing `.dejavu/`.
