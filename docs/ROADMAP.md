# Roadmap

## P0: usable local bootstrap

- [x] Implement `dejavu init` to create the minimal `.dejavu/` structure without overwriting user files.
- [x] Implement `dejavu orient <task>` with source-linked, bounded task context.
- [x] Add portable agent instructions and a basic validation command (`dejavu check`).
- [x] Add fixtures, unit tests, and documentation. (CI and release packaging: #8.)

## P1: memory lifecycle

- [ ] Compact agent-to-agent session handoffs.
- [ ] Evidence-linked `dejavu learn` proposals with human approval.
- [ ] `dejavu reconcile` for contradictions, stale entries, and supersession.
- [ ] Pilot against Made by Awan, NoteFriends, Awan Sound Machines, and Awan Arcade.

## P2: optional extensions

- [ ] Compare with Spec Kit workflows, without requiring Spec Kit.
- [ ] Benchmark optional temporal knowledge graph approaches (e.g., Graphiti).
- [ ] Measure token use, repeated exploration, handoff quality, and recurring mistakes.
