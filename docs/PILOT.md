# Pilot: Made by Awan repositories

Status: phase 1 (local, read-only) complete, 2026-10-18. Tracks [#6](https://github.com/madebyawan/dejavu/issues/6).

The pilot repositories are private, so this report gives only aggregate numbers and generic task descriptions. It contains no file names, issue text, or agent output from those repositories.

## Phase 1: local measurement

Method: shallow clones of the four repositories in a scratch directory, so the originals were not touched. The installs used the CLI at the head of the [#15](https://github.com/madebyawan/dejavu/pull/15) stack plus this change.

### Install (`dejavu init --mode adopt-existing --skills all`)

| Repository | Docs indexed | Result |
| --- | --- | --- |
| Made by Awan | 12 files | 10 files created; existing `AGENTS.md` and `CLAUDE.md` untouched; `check` passed |
| NoteFriends | 516 files | same |
| Awan Sound Machines | 154 files | same |
| Awan Arcade | 12 files | same |

Findings:
- **Fixed in this change:** in the two large repositories, the index truncated alphabetically at 100 files, hiding whole folders such as ticket and bug archives and decision logs. Large folders are now summarized by subfolder, with links and file counts. Small subfolders are listed in full. The largest index went from 100 files plus "…and 415 more" to a 135-line index that covers every folder.
- **Expected:** every repository already has an `AGENTS.md`, so init left it alone and suggested a one-line pointer. One repository's `CLAUDE.md` does not point to `AGENTS.md`, and init suggested that pointer too. Adding these is part of a reviewed install PR.

### Context size (`dejavu orient`, default 1200-token budget)

| Repository | Corpus (estimated tokens) | `orient` output | Share |
| --- | --- | --- | --- |
| Made by Awan | ~10k | ~1.1k | 11% |
| NoteFriends | ~664k | ~1.0k | 0.1% |
| Awan Sound Machines | ~305k | ~1.0k | 0.3% |
| Awan Arcade | ~18k | ~0.8k | 5% |

Runtime was 60–470 ms per query.

### Agent runs with and without `orient`

[`scripts/benchmark-agent.mjs`](../scripts/benchmark-agent.mjs) runs Claude Code headless and read-only (`Read`, `Grep`, `Glob`; project settings only) in a fresh clone. The prompt asks the agent to find the 3–6 files to read first for a task and list the constraints that apply. The same prompt runs once alone and once with the `orient` output (about 1.1k tokens) appended. Each repository got one task based on real, current work:

| Repository | Task type | Turns | Input tokens | Time | Cost |
| --- | --- | --- | --- | --- | --- |
| Made by Awan | Add a project to the landing page | 5 → 4 | −22% | 0% | −10% |
| NoteFriends | UI bug fix from an open issue | 8 → 8 | +1% | +7% | −7% |
| Awan Sound Machines | New module reusing a shared engine | 7 → 5 | −36% | −43% | −26% |
| Awan Arcade | Gameplay feature from an open issue | 5 → 8 | 0% | +10% | −22% |
| **Total** | | 25 → 25 | **−18%** | **−17%** | **−18%** |

Observations:
- **Answer quality was similar** in every pair. Both versions found the right files and constraints. With `orient`, agents checked the excerpts against the sources and said which excerpts did not apply. This is the intended behavior: the context is treated as leads, not truth.
- **The clearest gain was in a docs-heavy repository with a large ticket archive** (Sound Machines), where the relevant ticket and design spec are hard to find by browsing.
- **The smallest gain came when the answer lived in code** (the UI bug and the gameplay feature). `orient` indexes documentation, not source files, and these repositories already have strong `AGENTS.md` files that point agents to code quickly.

Limitations: one run per condition (agent runs vary a lot), one model, and a "find the sources" task rather than a full implementation. Treat the numbers as indicative, not significant.

## Phase 2: in-repository pilot (needs maintainer approval)

Each repository's pilot issue asks for a reviewed install on an isolated branch. Those steps change the pilot repositories, so they wait for approval:

1. Open an install PR in each repository: `adopt-existing`, plus a one-line `.dejavu/` pointer in `AGENTS.md`, plus the skill if wanted. Nothing else changes.
2. Write small ontology and topology entries that link to real files, reviewed by the owner.
3. Add lessons only from verified PRs or bugs, using `dejavu learn`. The owner accepts them with `dejavu reconcile accept --by`.
4. Over 2–4 weeks, record handoff success (`resume` used, and whether the next session continued without re-exploring) and any recurring mistakes covered by accepted wisdom.
5. Repeat the agent benchmark with three or more runs per condition and at least two tasks per repository, including one implementation task.

## Follow-ups suggested by phase 1

- Optionally add **source-path hints** to `orient`: list tracked files whose paths match the task's terms. This targets the "answer lives in code" cases without indexing source contents.
- Use **ontology terms for query expansion** before considering embeddings or a graph (see the [evaluation](evaluations/spec-kit-and-graphiti.md)).
