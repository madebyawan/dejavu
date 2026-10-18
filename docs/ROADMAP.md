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

## P1: compiled knowledge and repository organization (proposed, not shipped)

- [ ] [#19](https://github.com/madebyawan/dejavu/issues/19): reviewed, source-linked topic wiki schema.
- [ ] [#20](https://github.com/madebyawan/dejavu/issues/20): incremental `dejavu compile` source pack and agent proposal workflow.
- [ ] [#21](https://github.com/madebyawan/dejavu/issues/21): read-only `dejavu lint` drift checks.
- [ ] [#22](https://github.com/madebyawan/dejavu/issues/22): accepted wiki retrieval, ontology synonym expansion and source-path hints.
- [ ] [#23](https://github.com/madebyawan/dejavu/issues/23): public/synthetic repository-organization pilot.
- [ ] [#24](https://github.com/madebyawan/dejavu/issues/24): measured quality, tokens and maintenance overhead.
- [ ] [#25](https://github.com/madebyawan/dejavu/issues/25): optional agent lifecycle hooks and Spec Kit adapter.

Architecture and scope: [Knowledge Compiler RFC](KNOWLEDGE-COMPILER.md). The core remains local-first, model-neutral and human-reviewed. Never publish identifying details of nonpublic evaluation targets.
