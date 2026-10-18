# Roadmap

## P0: usable local bootstrap

- [x] Implement `dejavu init` to create the minimal `.dejavu/` structure without overwriting user files.
- [x] Implement `dejavu orient <task>` with source-linked, bounded task context.
- [x] Add portable agent instructions and a basic validation command (`dejavu check`).
- [x] Add fixtures, unit tests, and documentation. (CI and release packaging: #8.)

## P1: memory lifecycle

- [x] Compact agent-to-agent session handoffs (`dejavu handoff`, `dejavu resume`).
- [x] Evidence-linked `dejavu learn` proposals with human approval.
- [x] `dejavu reconcile` for contradictions, stale entries, and supersession.
- [ ] Pilot across representative repositories without publishing any nonpublic repository identities or content. Phase 1 aggregate local measurements are documented in [PILOT.md](PILOT.md).

## P2: optional extensions

- [x] Compare with Spec Kit workflows, without requiring Spec Kit ([evaluation](evaluations/spec-kit-and-graphiti.md)).
- [x] Evaluate optional temporal knowledge graph approaches, e.g. Graphiti ([evaluation](evaluations/spec-kit-and-graphiti.md)): not adopted for now.
- [ ] Measure token use, repeated exploration, handoff quality, and recurring mistakes.
