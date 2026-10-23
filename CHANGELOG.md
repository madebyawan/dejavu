# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). Until 1.0.0, minor versions may include breaking changes.

## [Unreleased]

## [0.3.0] - 2026-10-23

Less context: handoffs no longer pile up, and Déjà Vu steps aside for graphify.

### Changed

- Each branch keeps at most one handoff, `.dejavu/handoffs/<branch>.md`; recording again replaces it. Outside Git, there is one per task.
- Handoffs no longer list changed files; `resume` points to `git diff` instead.
- `resume` and the brief only show the current branch's handoff, and count the others.
- A handoff whose branch was merged into its base or deleted is treated as closed. `resume --list` shows why.
- New repositories Git-ignore `.dejavu/handoffs/` (via `.dejavu/handoffs/.gitignore`). Run `dejavu init` in an existing repository to add it.
- The Stop hook only reminds about a handoff when the session leaves uncommitted changes. Committed work is finished or recoverable from Git.
- The per-request hook leaves out documents that match only one word of the request.
- In repositories with a graphify graph (`graphify-out/graph.json`), Déjà Vu leaves code structure to graphify: the brief points to `graphify query` instead of listing components; each request gets only lessons, facts, assumptions, open questions, and terms, within ~400 tokens instead of ~800; and setup no longer asks for components.
- Documentation discovery skips `graphify-out/`.

### Removed

- `dejavu handoff --file`.

## [0.2.0] - 2026-10-19

Déjà Vu now runs itself in Claude Code and asks before it remembers.

### Added

- Claude Code plugin (`/plugin marketplace add madebyawan/dejavu`, then `/plugin install dejavu@dejavu`). Its hooks:
  - offer setup in any Git repository that has no `.dejavu/` (once; `dejavu setup --decline` stops it);
  - add the project brief at session start, and again after `/clear` or compaction;
  - add matching memory to each request, never repeating a section within a session;
  - remind the agent once per session to record a handoff after files changed.
- `dejavu setup`: creates `.dejavu/` if needed (adopting existing docs) and writes `.dejavu/setup.md`, a checklist of what memory is missing. The agent drafts what the code shows and asks the maintainer about the rest.
- `dejavu remember`: appends a confirmed fact, assumption, open question, term, or component with its source (`--source maintainer` for answers given in conversation). Rejects secrets; skips duplicates.
- `dejavu brief`: a short summary of project memory for the start of a session.
- `dejavu hook <session-start|prompt|stop>`: the hook handlers the plugin calls.

### Changed

- The skill and the `AGENTS.md` pointer now tell agents to ask "Should I remember that …?" when they learn something durable, and to record it only if the maintainer agrees.

### Fixed

- Handoffs listed the wrong path for an uncommitted change when it was the first line of `git status`.

## [0.1.0] - 2026-10-18

First release, published to npm as `dejavu-memory`. The command is `dejavu`.

### Added

- `dejavu init` with `minimal` (default), `structured`, and `adopt-existing` modes; never overwrites existing files.
- `dejavu orient <task>`: bounded, source-linked, labeled context from docs and accepted knowledge.
- `dejavu handoff` and `dejavu resume`: compact Git-aware session handoffs that reject secrets and transcript-sized input.
- `dejavu learn`: evidence-backed lesson proposals with validated evidence references; never auto-promoted.
- `dejavu reconcile`: read-only review of lesson metadata, evidence, supersession, staleness, duplicates, and contradictions; `accept`, `reject`, and `supersede` actions that require a named reviewer and preserve history.
- `dejavu check` for required `.dejavu/` paths, broken local links, and skill frontmatter.
- Canonical agent skill at `skills/dejavu/SKILL.md`, installable for Claude Code and Codex with `init --skills`.
- `adopt-existing` summarizes large documentation folders by subfolder instead of truncating, and indexes Spec Kit's `.specify/memory/` constitution.
- `scripts/benchmark-agent.mjs` compares headless Claude Code runs with and without `orient`.
- CI on Node 22 and 24 across Linux, macOS, and Windows, with sample fixture repositories and a packed-tarball smoke test.
