# Evaluation: Spec Kit and Graphiti integrations

Status: recommendation, 2026-10-18. Tracks [#7](https://github.com/madebyawan/dejavu/issues/7).

**Constraint:** both integrations must stay optional, and the base CLI must keep working with no database, hosted service, or API key.

## Summary

| | Spec Kit | Graphiti |
| --- | --- | --- |
| What it is | Spec-driven development toolkit: `specify` CLI, `/speckit.*` agent commands, `specs/` and `.specify/` files | Python framework for temporal knowledge graphs, with an MCP server |
| Overlap with Déjà Vu | Low. Spec Kit produces specs and plans for a feature; Déjà Vu indexes enduring docs and reviewed lessons across features | Medium. Both model facts that change over time, but Graphiti stores them in a database |
| Infrastructure | Files only. The CLI is Python, but Déjà Vu does not need it | Python 3.10+, a graph database (Neo4j, FalkorDB, or Neptune; the embedded Kuzu backend is deprecated), and an LLM plus embeddings provider (OpenAI by default, ideally with structured output) |
| Recommendation | **Adopt the file-level integration now; build an extension after the pilot** | **Do not integrate now.** Borrow its validity-window idea; revisit only if the pilot shows a retrieval gap that files cannot close |

## Spec Kit

### What matters for Déjà Vu

- Spec Kit's durable project rules live in `.specify/memory/constitution.md`. Feature work lives in `specs/NNN-feature/` (spec, plan, tasks).
- Extensions install into `.specify/extensions/<ext>/`, and hooks are registered in `.specify/extensions.yml` under `before_<command>` / `after_<command>` events (for example `before_implement`, `after_tasks`). Presets override command, template, and script files. ([Spec Kit reference](https://github.github.com/spec-kit/reference/overview.html), [extensions](https://github.github.com/spec-kit/reference/extensions.html))
- The ecosystem is active: more than 100 community extensions and about 20 presets as of 2026 ([Spec Kit site](https://github.github.com/spec-kit/), [Microsoft developer blog, 2026-10-07](https://developer.microsoft.com/blog/from-spec-first-to-enterprise-ready-extending-github-spec-kit/)).

### Shipped in this change (no Spec Kit dependency)

- `dejavu init --mode adopt-existing` and `dejavu orient` already index `specs/`. They now also index `.specify/memory/` (the constitution) as an authoritative source. Spec Kit templates and extension folders are not indexed. Covered by `test/init.test.mjs`, "indexes Spec Kit specs and constitution".

### Proposed follow-up: a `dejavu` Spec Kit extension

The extension would be a thin adapter that calls the CLI and adds no logic:

| Hook | Command | Purpose |
| --- | --- | --- |
| `before_plan` | `dejavu orient "<feature summary>"` | Bring accepted lessons and relevant docs into planning |
| `after_implement` (optional) | `dejavu handoff --task "<feature>" …` | Record state for the next session |
| `after_implement` (optional) | prompt to run `dejavu learn` when a bug or review produced a lesson | Capture evidence-backed proposals; never auto-accept |

Before building it:
1. Confirm the `extension.yml` manifest schema; the reference pages consulted did not document all fields.
2. Pilot it in one repository that already uses Spec Kit.
3. Keep it in a separate folder (`integrations/spec-kit/`) so the core stays dependency-free.

## Graphiti

### What it offers

- Facts carry validity windows. When information changes, old facts are invalidated rather than deleted, and every fact traces back to the episode that produced it. ([Graphiti README](https://github.com/getzep/graphiti))
- Hybrid semantic, keyword, and graph search, plus an MCP server for agents.
- Apache-2.0 licensed. Telemetry is on by default (`GRAPHITI_TELEMETRY_ENABLED=false` disables it).

### Why not now

1. **It needs infrastructure the constraints forbid as a requirement.** A database service is required, because the embedded Kuzu backend is deprecated. An LLM and embeddings provider is required too; local models through Ollama are possible, but small models often fail its schema checks. ([Graphiti README](https://github.com/getzep/graphiti), [graphiti-core on PyPI](https://pypi.org/project/graphiti-core))
2. **Determinism and review.** Graphiti extracts entities and facts with an LLM. Déjà Vu's rule is that agent output never becomes canonical without human review, and that the same input gives the same `orient` output. A graph built by LLM extraction would need its own review step.
3. **No measured gap yet.** On the pilot repositories, `orient` with keyword ranking returns about 1k tokens of relevant context from corpora of up to about 660k tokens (see [PILOT.md](../PILOT.md)). Graph retrieval is only worth adding if the pilot shows keyword recall failing on real tasks, for example when a task uses synonyms the docs never mention.

### What to borrow

- **Validity windows:** Déjà Vu already records `supersedes`, `superseded_by`, and `superseded_on`. Consider adding optional `valid_from` / `valid_until` fields to epistemology entries, so "known" facts can expire and `reconcile` can flag them.
- **Provenance:** every lesson already requires evidence. Keep it that way.

### When to revisit

Benchmark an optional Graphiti adapter only if all of these hold:
- `orient` misses the authoritative source on more than 20% of pilot tasks.
- Cheaper fixes do not close the gap, such as expanding queries with ontology terms or adding synonyms to the ontology.
- A team is willing to run the database and LLM.

The adapter would export `.dejavu/` and the docs as episodes. Files would stay canonical, and the graph would be a disposable cache that can be rebuilt.
