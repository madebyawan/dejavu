# Pilot: aggregate local measurements

Status: phase 1 (read-only local evaluation) completed 2026-10-18. Tracks [#6](https://github.com/madebyawan/dejavu/issues/6).

**Publication boundary:** Never disclose or link nonpublic repository names, organizations, URLs, paths, issues, PRs, source text, screenshots, commands containing identifiers, or task prompts in this public project. This document intentionally includes **aggregate results only**. All reproducible public tests should use fictional fixtures or explicitly public repositories.

## Phase 1: summary

Four different local repositories were evaluated in isolated shallow checkouts; source repositories were left unchanged. The evaluation covered a range of documentation corpus sizes, including large documentation archives.

`dejavu init --mode adopt-existing --skills all` did not overwrite existing `AGENTS.md` or `CLAUDE.md`; subsequent validation passed in every sample.

Findings:
- Previously, indexes for documentation-heavy repositories stopped after 100 alphabetically listed files and omitted later folders. The implementation now summarizes large subfolders instead, ensuring high-level coverage of every folder.
- When a repository already has an agent instruction file, setup leaves it alone and suggests a minimal knowledge-layer pointer rather than rewriting it.
- `dejavu orient` emitted task-relevant excerpts within its default 1200-token budget, instead of loading entire documentation corpora. Local query times ranged from 60 to 470 ms.

### Agent runs with and without orientation

[`scripts/benchmark-agent.mjs`](../scripts/benchmark-agent.mjs) runs a coding agent headless and read-only in a fresh checkout and measures file-discovery tasks with and without `orient` context. Across the four *single-run paired cases*:

| Metric | Aggregate result |
| --- | --- |
| Agent turns | 25 → 25 |
| Input tokens | 18% lower |
| Elapsed time | 17% lower |
| Model cost | 18% lower |

**Interpretation:** the additional orientation context helped most when relevant documentation was hard to discover by browsing. It sometimes had little benefit when answers were directly in code. Answer quality appeared similar in these exploratory runs, and the agent checked the source excerpts against the underlying repository.

**Limitations:** only one run per condition, one model, and source-finding rather than actual end-to-end implementation. These results are indicative, not statistically significant. No 10× or 80% performance claim is supported by this evaluation.

## Phase 2: opt-in pilot

A reviewed installation in any target repository requires its maintainer's approval:

1. Open an isolated branch and run adopt-existing mode without overwriting existing instructions.
2. Index authoritative docs and create small, source-linked ontology/topology entries.
3. Propose evidence-backed lessons for review; never accept them automatically.
4. Over 2–4 weeks, measure retrieval correctness, handoff quality, repeated exploration, and recurring mistakes.
5. Repeat agent comparisons with three or more runs per condition and at least two tasks per repository, including an implementation task.

Publish only aggregate statistics that have been reviewed for re-identification risk. Source-linked reports and repository-specific findings stay **within their own authorization boundary**, never copied into this public repository.

## Follow-ups

- Add optional code-path hints for tasks whose answer is not in documentation.
- Expand task queries using reviewed ontology synonyms before considering embeddings.
- Evaluate a source-linked compiled wiki and drift detection using **synthetic or explicitly public fixtures**.
