# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). Until 1.0.0, minor versions may include breaking changes.

## [Unreleased]

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
