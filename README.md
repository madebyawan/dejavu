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

## Quick start

Requires Node.js 22 or later. There are no runtime dependencies.

### Claude Code (automatic)

Install the plugin once, in Claude Code:

```text
/plugin marketplace add madebyawan/dejavu
/plugin install dejavu@dejavu
```

On Claude Code 2.1.275 or later, `/plugin install dejavu --marketplace madebyawan/dejavu` does both in one step.

From then on, in every Git repository:

- **No memory yet?** Claude offers to set it up. If you agree, it runs `dejavu setup`, drafts terms and components from the code, and asks you a few questions about what the code cannot show. Decline once and it stops asking in that repository.
- **Every session** starts with a short project brief, and each request gets the memory that matches it.
- **As you work**, when Claude learns something durable — you correct it, or state a decision or constraint — it asks "Should I remember that …?" and records it only if you say yes.
- **When files changed**, Claude is reminded once to leave a handoff for the next session.

### Any agent (manual)

The npm package is `dejavu-memory` and the command is `dejavu`:

```sh
cd your-project
npx dejavu-memory setup     # or: npm install -g dejavu-memory && dejavu setup
npx dejavu-memory check
```

`setup` writes `.dejavu/setup.md`, a checklist of what memory is missing, for your agent to work through with you. The `AGENTS.md` pointer it creates tells other agents, such as Codex, to run `dejavu brief` at the start of a task and to ask before remembering.

To run from a checkout instead, use `node path/to/dejavu/bin/dejavu.mjs <command>`.

`init` only creates files that are missing. It never modifies, moves, or deletes existing files, so running it again is safe. Use `--dry-run` to preview what it would create.

## Commands

### `dejavu setup [dir]`

Creates `.dejavu/` if it is missing (indexing existing docs when there are any), then writes `.dejavu/setup.md`: a checklist of the gaps it found — overview, key terms, components, sources of truth, past decisions, things the code does not show, known traps, open questions, and agent rules. Your agent drafts what the code shows and asks you about the rest, ticking items off as you answer or skip them. Reruns never overwrite the checklist. `--decline` records, outside the repository, that you do not want Déjà Vu there; `--undo-decline` reverses it.

### `dejavu remember <text> --as <kind>`

Appends one confirmed entry with its source. Agents run it only after you agree.

```sh
dejavu remember "Scores reset on every deploy" --as known --source maintainer
dejavu remember "A single playable game" --as term --name Cabinet --source src/cabinet.js
dejavu remember "Runs the game loop" --as component --name Engine --depends Renderer --source src/engine.js
dejavu remember "Do players want accounts?" --as question
```

Kinds: `known`, `assumption`, `question`, `superseded` (epistemology), `term` (ontology), and `component` (topology). Sources are file paths with optional lines, commits, `#12` or `owner/repo#12`, URLs, or `maintainer`. Secrets are rejected and duplicates skipped.

### `dejavu brief`

Prints a short summary of project memory — accepted lessons, known facts, terms, components, open questions, the open handoff, setup progress, and how to grow memory. The plugin adds it at the start of each session.

### `dejavu hook <event>`

The handlers behind the Claude Code plugin's hooks: `session-start`, `prompt`, and `stop`. They read the hook's JSON on stdin, stay silent outside Git repositories, and never fail a session. Per-session bookkeeping and declined repositories are stored outside the repository (in the plugin's data folder, or `~/.config/dejavu`).

### `dejavu init [dir]`

| Mode | Creates | Use for |
| ---- | ------- | ------- |
| `minimal` (default) | `.dejavu/` and thin `AGENTS.md`/`CLAUDE.md` pointers | Any repository; the least invasive option |
| `structured` | `minimal` plus `docs/00-overview` … `docs/06-reference` | New projects that want the [documentation structure](docs/DOCUMENTATION-STRUCTURE.md) |
| `adopt-existing` | `minimal` plus an index of your existing docs | Existing repositories with their own documentation layout |

```sh
dejavu init --mode adopt-existing             # index docs/, doc/, adr/, specs/, …
dejavu init --mode adopt-existing --docs handbook/engineering
dejavu init --mode structured --skills all    # also install the agent skill
dejavu init --no-agents                       # skip AGENTS.md / CLAUDE.md
```

Every mode writes `.dejavu/index.md`, a list of links to your documentation with the files' headings. It links to the files and does not copy their contents. In `adopt-existing` mode, Déjà Vu indexes top-level Markdown files and any of `adr/`, `adrs/`, `decisions/`, `design/`, `doc/`, `docs/`, `documentation/`, `rfc/`, `rfcs/`, `spec/`, `specs/`, and `wiki/` that exist (up to four levels deep), plus any `--docs` paths.

If `AGENTS.md` or `CLAUDE.md` already exist, init leaves them alone and suggests a one-line pointer you can add yourself.

### `dejavu orient <task>`

Prints the sections of your documentation and accepted `.dejavu/` knowledge that best match a task. Each excerpt has a `path:line` link and a label: `source` (an authoritative document), `accepted lesson` (reviewed wisdom), `known`, `assumption`, `open question`, or `knowledge` (an ontology or topology entry to verify). Output stays within a token budget and ends with a summary comparing its size to loading every document. Proposals, handoffs, and superseded entries are never included.

```sh
dejavu orient "fix duplicate webhook processing"
dejavu orient "add a database migration" --budget 800 --dir ../payments
dejavu orient "release process" --json     # path, line, label, and score per excerpt
```

Ranking is deterministic keyword relevance (BM25) over Markdown sections, so the same repository and task always give the same output.

### `dejavu handoff` and `dejavu resume`

`handoff` writes compact session state to `.dejavu/handoffs/YYYY-MM-DD-<task>.md`. It reads the branch, commit, and changed files from Git, and you supply the rest. Items over 500 characters, or that look like credentials (tokens, keys, `password=`…), are rejected, which keeps transcripts and secrets out. Existing handoffs are never overwritten.

```sh
dejavu handoff --task "Add login redirect" --pr 42 \
  --tests "npm test: 53 passed" \
  --question "Should redirects keep query params?" \
  --next "Handle expired sessions"
dejavu resume          # newest open handoff, preferring the current branch
dejavu resume --list   # every handoff with its status
```

`resume` notes when the handoff came from another branch or files have changed since its commit. Set `status: closed` in a handoff's frontmatter when it is done.

### `dejavu learn`

Proposes a lesson for a maintainer to review. A lesson needs a summary, context, cause, prevention step, and at least one piece of evidence: a URL, `#12` or `owner/repo#12`, a commit in the repository, or an existing `file[:line]`. Local evidence and commits are checked before anything is written.

```sh
dejavu learn --summary "Deduplicate webhook events before processing" \
  --context "A retried delivery charged a customer twice." \
  --cause "The worker processed events without checking the idempotency key." \
  --prevention "Insert with a unique key; skip on conflict." \
  --evidence "#88" --evidence src/webhooks/handler.js:42 --confidence high
```

The lesson is written to `.dejavu/proposals/P-NNNN-<summary>.md` with `status: proposed`. `orient` never shows proposals, and nothing promotes them automatically.

### `dejavu reconcile`

Without arguments, `reconcile` prints a read-only review of proposals and wisdom:

- Missing or invalid metadata and duplicate IDs
- Lessons without evidence, and broken evidence links
- Missing or one-sided supersession
- Accepted lessons whose local evidence files changed after acceptance
- Possible duplicates or contradictions between accepted lessons
- Proposals awaiting review, including any similar to existing wisdom

It exits `1` when there are errors.

Changing canonical knowledge requires a named reviewer:

```sh
dejavu reconcile accept P-0004 --by "Adam Wan"            # creates W-NNNN, marks superseded lessons
dejavu reconcile reject P-0005 --by "Adam Wan" --reason "Not reproducible"
dejavu reconcile supersede W-0002 --with W-0007 --by "Adam Wan"
```

Accepting copies the proposal into `wisdom/` with `accepted_by` and `accepted` dates. It keeps the proposal as history with `accepted_as`. Nothing is deleted. Use `--dry-run` to see which files would change. Agents should propose with `learn` and leave these decisions to maintainers.

### `dejavu check [dir]`

Checks that `.dejavu/` has its required files and that local links in `.dejavu/`, `AGENTS.md`, and `CLAUDE.md` resolve. It also checks that installed skills have valid frontmatter. Errors include the file and line plus a suggested fix. The command exits `1` on errors, `2` on usage errors, and `0` otherwise. Warnings, such as an `AGENTS.md` that doesn't mention `.dejavu/`, don't cause a failure.

```text
error: .dejavu/index.md:12: broken link to ../docs/old.md. Fix the path or remove the link.
```

## Knowledge layout

```text
.dejavu/
  README.md        # rules and entry points
  index.md         # links to authoritative docs
  ontology.md      # concepts and vocabulary
  topology.md      # systems and responsibilities
  epistemology.md  # known, assumed, open, superseded
  wisdom/          # accepted lessons (reviewed)
  proposals/       # unreviewed lesson candidates
  handoffs/        # concise session state
  setup.md         # setup checklist, ticked off as gaps are filled
```

See [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) for the format.

## Agent skill

The canonical skill is [`skills/dejavu/SKILL.md`](skills/dejavu/SKILL.md). It tells agents how to set up memory, orient to the project, ask before remembering, write handoffs, and propose lessons. The Claude Code plugin includes it. To install it without the plugin, run `dejavu init --skills claude,codex` (or `all`) in each project. That copies the file to the locations each agent documents:

| Agent | Project | Personal |
| ----- | ------- | -------- |
| Claude Code | `.claude/skills/dejavu/SKILL.md` | `~/.claude/skills/dejavu/SKILL.md` |
| Codex | `.agents/skills/dejavu/SKILL.md` | `~/.agents/skills/dejavu/SKILL.md` |

For a personal install, copy the folder: `cp -R skills/dejavu ~/.claude/skills/` or `cp -R skills/dejavu ~/.agents/skills/`. Run `/skills` in either agent to confirm it was found.

## Roadmap

See the [roadmap](docs/ROADMAP.md), [Knowledge Compiler proposal](docs/KNOWLEDGE-COMPILER.md), and [issues](https://github.com/madebyawan/dejavu/issues). A compiled wiki, `compile` and `lint` are proposed—not part of the released CLI.

## Development

```sh
npm test
```

Tests use Node's built-in test runner, temporary directories, and sample repositories in `test/fixtures/`. See [docs/RELEASING.md](docs/RELEASING.md) for CI, versioning, and releases, and [docs/PILOT.md](docs/PILOT.md) for measurements on real repositories.

## License

MIT.
