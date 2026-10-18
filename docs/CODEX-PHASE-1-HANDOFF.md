# Codex handoff — Phase 1: first working Déjà Vu CLI

## Objective
Deliver a working, zero-runtime-dependency Node.js CLI for Git-native project documentation and memory scaffolding.

## Source of truth
Read these before editing:
- README.md
- SKILL.md
- docs/ARCHITECTURE.md
- docs/KNOWLEDGE.md
- docs/DOCUMENTATION-STRUCTURE.md
- docs/ROADMAP.md
- GitHub issues #1 and #9

## Deliverables
1. A minimal package.json with a `dejavu` executable and local invocation support (`node bin/dejavu.mjs` and `npm exec -- dejavu` when installed).
2. `dejavu init` with `--mode structured|minimal|adopt-existing`; choose a safe default and document it. No prompts required for scripted execution.
3. **Structured:** scaffold the proposed docs/00-overview through docs/06-reference hierarchy and .dejavu/ knowledge templates. Keep files meaningful but short; add a project index and links to authoritative docs.
4. **Minimal:** scaffold only .dejavu/ and optional thin agent pointers; never replace existing AGENTS.md/CLAUDE.md.
5. **Adopt-existing:** discover existing docs paths, create a small index with source links, and preserve existing folder structure. Do not copy full documents.
6. `dejavu check`: verify that the installed scaffold is well-formed, report missing paths or broken local links with actionable output, and exit nonzero for errors. Keep scope small.
7. Portable skill packaging: installable Claude Code and Codex skill directories (or documented generated adapters) using a canonical SKILL.md. Confirm both agents can discover the skill using their documented locations; avoid duplicating long instructions.
8. README quick start and examples.
9. Tests using Node's built-in test runner and temp directories. Include reruns, existing files, nonstandard docs, CLI help/error paths, and validation behavior.

## Constraints
- No database, network service, external runtime dependency, or required API key.
- GitHub Issues remain the task tracker; specs and code are authoritative.
- No silent overwrites, file moves, or deletion of user content.
- No automatic lesson promotion or speculative project facts.
- Keep output deterministic, readable, and useful for human maintainers.
- No implementation of orient, learn, reconcile, or session handoffs in this PR. Their interfaces may be described but not advertised as working.
- Do not publish to npm or release a package without approval.

## Definition of done
- CLI runs on a fresh checkout with a supported Node version.
- Structured, minimal, and adopt-existing modes behave as documented.
- Running init twice is safe and leaves existing files unchanged.
- Existing AGENTS.md/CLAUDE.md and documentation survive untouched.
- `npm test` passes.
- README reflects only shipped behavior.
- Open a PR referencing #1 and #9, summarize design choices, tests, and any follow-ups.

## Agent workflow
Work on a feature branch. Read repo docs first. Implement smallest useful solution. Run tests and review diff. Open PR; do not merge automatically.
