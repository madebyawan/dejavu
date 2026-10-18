# Architecture

Déjà Vu is a lightweight knowledge layer for coding agents, not an agent orchestrator.

## Knowledge lifecycle

1. **Orient**: identify the current task and assemble only relevant project knowledge, with source links.
2. **Work**: the coding agent uses normal repository tools and authoritative source documents.
3. **Handoff**: preserve concise state, decisions, tests, and next actions when a session ends.
4. **Learn**: propose evidence-backed lessons from completed work, PRs, bugs, and corrections.
5. **Reconcile**: review proposals, detect stale claims and contradictions, and mark superseded knowledge.

## Storage

Use ordinary Markdown under `.dejavu/` with stable IDs and links to source evidence. Avoid indexing private data into public outputs. Source files, ADRs, specifications, and GitHub Issues retain authority. No database, external API, or hosted service is required for the base workflow.

## Integrations

Agent adapters should be thin, optional instructions for Claude Code, Codex, and other agents. The core remains usable from a shell or by reading files directly.
