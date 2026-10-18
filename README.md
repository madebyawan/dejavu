# Déjà Vu

**Your agents have been here before.**

An open-source, Git-native knowledge and memory harness for AI coding agents.

Déjà Vu helps agents inherit a project's architecture, decisions, constraints, and hard-earned lessons without replaying every past conversation.

## Principles

- **Local-first and Git-native:** Markdown files live alongside your code.
- **Agent-neutral:** useful with Claude Code, Codex, and other coding agents.
- **Evidence-backed:** lessons point to source files, issues, and PRs.
- **Human-reviewed:** agents propose knowledge; maintainers decide what becomes canonical.
- **Context on demand:** orient each agent with task-relevant information, not a giant transcript.
- **No duplicate authority:** specs, code, ADRs, and issue trackers remain authoritative.

## Planned CLI

```sh
dejavu init
dejavu orient "task description"
dejavu learn
dejavu reconcile
```

These commands describe the intended interface; implementation is in progress.

## Roadmap

1. Bootstrap a portable knowledge folder and agent instructions.
2. Compile task-scoped context from existing documentation.
3. Capture compact session handoffs.
4. Propose evidence-linked lessons from completed work.
5. Reconcile stale, contradictory, and superseded knowledge.
6. Benchmark token savings and agent effectiveness on real repositories.

## License

MIT.
