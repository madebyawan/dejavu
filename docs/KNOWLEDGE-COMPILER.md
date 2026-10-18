# Knowledge Compiler — a source-linked, agent-maintained wiki

Status: **design proposal**, 2026-10-18. No command or wiki feature in this document should be presented as shipped. Implementation issues: [#19](https://github.com/madebyawan/dejavu/issues/19), [#20](https://github.com/madebyawan/dejavu/issues/20), [#21](https://github.com/madebyawan/dejavu/issues/21), [#22](https://github.com/madebyawan/dejavu/issues/22), [#23](https://github.com/madebyawan/dejavu/issues/23), [#24](https://github.com/madebyawan/dejavu/issues/24), [#25](https://github.com/madebyawan/dejavu/issues/25).

## Thesis

The useful part of the *LLM-as-wiki-compiler* idea is not a particular model or notes application. Agents work better when they inherit **short, actively maintained understanding of a project**, complete with sources and uncertainty, rather than replaying a growing transcript or rediscovering every earlier decision.

Déjà Vu already offers task-scoped `orient`, a navigable index, ontology, topology, epistemology, accepted Wisdom, evidence-backed proposals, and handoffs. The missing layer is **compiled knowledge**: topic pages synthesizing the current state of multiple authoritative sources, incrementally maintained by an agent and admitted only after review.

> Sources tell us what happened. Compiled knowledge tells an incoming agent what is currently understood, why, and what to verify. Wisdom captures reusable mistakes and preventive checks.

## Boundaries (non-negotiable)

1. **Authority stays where it already lives.** Code, tests, ADRs, specs, docs and issue trackers retain their authority. The wiki is a derived, navigable interpretation with pointers, not another tracker or independently editable specification.
2. **Agents propose; maintainers accept.** No generated assertion or wiki update becomes canonical without review. Proposals are not included in task orientation.
3. **No mandatory hosted components.** The base CLI remains local-first, Git-native, deterministic, cross-platform, dependency-light, and usable without network access, embeddings, an LLM key or a database.
4. **Source evidence and epistemic state are visible.** Claims are labeled known, assumption, conflicting, unknown, stale or superseded, with source references and verification metadata where available.
5. **No publication of nonpublic repository details.** Public issues, docs, demos, fixtures, benchmarks, PRs, comments, logs and commit messages may only use fictional or explicitly public source examples; never copy nonpublic repository identifiers, paths, issue numbers, URLs, source text or task prompts here. Results from nonpublic local evaluations may only be published as reviewed, anonymized aggregates.
6. **No new orchestrator.** Déjà Vu supplies context and a repeatable knowledge workflow; Claude Code, Codex, or another caller remains responsible for model inference, decisions and execution.

## Three layers

| Layer | Storage | Responsibility |
| --- | --- | --- |
| Sources of truth | Existing repository docs, code, ADRs, and issue tracker | Evidence, decisions, actual current implementation |
| Compiled knowledge | `.dejavu/wiki/*.md` (proposed) | Source-linked cross-document synthesis and current-state explanations |
| Agent behavior | `AGENTS.md` and the portable Déjà Vu skill | When to orient, inspect source evidence, compile proposals, review, hand off and learn |

Existing `.dejavu/index.md` remains a navigable list of source documents. Ontology defines concepts and synonyms, topology maps responsibilities and dependencies, epistemology records certainty, and Wisdom covers verified failure patterns and prevention. Compiled wiki pages should link to these rather than duplicate them.

### Proposed folder shape

```text
.dejavu/
  README.md
  index.md
  ontology.md
  topology.md
  epistemology.md
  wiki/
    README.md
    service-lifecycle.md
  wiki-proposals/
    ...
  wisdom/
  proposals/       # Existing Wisdom proposals, not wiki proposals
  handoffs/
```

Do not create unused folders in existing installations unless the user opts into the feature; `dejavu init` must remain non-destructive.

### Proposed wiki page contract

A topic page has a stable identity, concise summary, review status, last verification, related concepts, an explanation, supporting source references, outstanding uncertainty and supersession links. A fictional example:

```md
---
id: K-0001
status: accepted
verified_at: 2026-10-18
superseded_by: []
---

# Billing webhook processing

## Current understanding
The worker deduplicates deliveries before initiating charges.

## Why
Repeated provider deliveries must not cause a second charge.

## Source evidence
- [Accepted design](../../docs/decisions/004-webhook-idempotency.md)
- [Implementation](../../src/billing/webhook-handler.mjs)

## Open questions
- Do delayed retries share the same idempotency key?
```

This example is **fictional**. The exact frontmatter schema, ID assignment and link types should be finalized under #19 and tested against existing Markdown utilities. Never present a source path as valid unless it exists in the target repository.

## Agent workflow: compile, verify, review

1. **Discover changed sources.** `dejavu compile --changed [--base <ref>]` is a proposed command. Its CLI stage deterministically identifies relevant changed files and existing wiki pages without calling an LLM.
2. **Assemble a bounded source pack.** Include source paths, versions, applicable accepted knowledge and important unresolved claims. Do not upload secrets or unrelated files.
3. **Synthesize candidate changes.** The calling agent produces wiki additions or diffs, captures evidence for each claim, and marks conflicts and uncertainties instead of resolving them by invention.
4. **Review before acceptance.** Keep candidates in a separate proposal area. A maintainer approves, revises or rejects proposed changes; acceptance records attribution and source versions.
5. **Orient future agents.** `dejavu orient` includes only accepted, current wiki knowledge with original sources and a limited token budget. It never implies that a derived summary is as authoritative as its evidence.
6. **Keep knowledge healthy.** `dejavu lint` reports broken links, stale source revisions, superseded statements, missing evidence and likely disagreements. Deterministic checks are distinguished from optional agent-assisted semantic analysis.

Compilation is **incremental**: updating one module should not rewrite unrelated wiki pages. A changed source can invalidate a claim; absent evidence must remain unknown, not become confirmed. No scheduled background daemon or automatic inference spend.

## Retrieval principles

- Prefer task-relevant summaries that lead to primary evidence rather than loading every page.
- Use ontology synonyms for query expansion before introducing semantic embeddings or a graph database.
- Include code-path hints for code-first tasks without indexing code contents by default.
- Limit repeated content across wiki, original documents and Wisdom.
- Emit path/line provenance and label summaries as derived knowledge.
- Hard-exclude unreviewed proposals, obsolete pages, expired claims and handoffs from `orient`.
- Preserve current behavior when no wiki is installed.

## Drift detection

`dejavu lint` is proposed as a read-only diagnostic tool. It can flag (a) explicit reference/version mismatches, (b) broken links and missing provenance, (c) supersession metadata contradictions, and (d) candidates for manual semantic review. It must **not** claim to automatically prove that two arbitrary Markdown paragraphs contradict each other.

A fictional fixture: `docs/architecture.md` describes append-only revisions while a newer accepted decision and implementation describe overwrite-only storage. The linter should highlight this as a verification candidate and preserve the historical context rather than deleting it.

The CLI should have stable human and JSON output, actionable locations, and separate severity from heuristic confidence.

## First external adoption: repository organization

Start with an isolated, opt-in pilot of the existing `adopt-existing` mode. Build a **concise source-linked map** of modules, architectural boundaries, key decisions, current work and evidence. Respect existing agent instructions, ownership, permissions and GitHub Issues as the task source of truth. Use a small number of reviewed wiki topics, not a bulk rewrite of all docs. Keep any nonpublic evaluation details entirely in their source repository; the public project contains only generic methods and sanitized aggregate metrics.

The pilot's first measurement is whether a fresh agent can find the right authoritative sources and identify an outdated claim more reliably and cheaply than ordinary browsing.

## Measurement and release gates

Compare: baseline agent instructions + browsing; current `dejavu orient`; `orient` with accepted compiled wiki. Measure relevance, factual errors, stale/unsupported claims, re-exploration, source discovery time, full-task quality, input/output token cost, and review/maintenance work. Use repeatable **public/synthetic fixtures** and multiple independent runs. Small-sample reductions must not be advertised as statistically significant or generalized as “10× speed.”

Implementation order:
1. #19: design source-linked wiki schema and review states.
2. #20: incremental source-pack/compilation proposal workflow.
3. #21: deterministic drift checks and optional semantic review.
4. #22: accepted wiki retrieval and ontology query expansion.
5. #23: public/synthetic repository organization pilot, with nonpublic deployments managed separately.
6. #24–25: measure real gains and integrate optional lifecycle adapters.

## Explicitly out of scope

Hosted model routing, mandatory embeddings, vector databases, graph infrastructure, autonomous changes to source documents, unsupervised acceptance of Wiki/Wisdom, automatic PR merges, a second work tracker, raw chat transcripts, and nonpublic source content in this public project.

## References

- [Andrej Karpathy: LLM Wiki proposal](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Déjà Vu architecture](ARCHITECTURE.md)
- [Knowledge format](KNOWLEDGE.md)
- [Evaluation: Spec Kit and Graphiti](evaluations/spec-kit-and-graphiti.md)
- [Aggregate pilot results](PILOT.md)
