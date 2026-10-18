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

Requires Node.js 22 or later. There are no runtime dependencies. The npm package will be `dejavu-memory` (the command is `dejavu`). It is not published yet, so run it from a checkout:

```sh
git clone https://github.com/madebyawan/dejavu.git
cd your-project
node ../dejavu/bin/dejavu.mjs init
node ../dejavu/bin/dejavu.mjs check
```

After installing it into a project (`npm install --save-dev ../dejavu`), you can run `npm exec -- dejavu init` instead.

`init` only creates files that are missing. It never modifies, moves, or deletes existing files, so running it again is safe. Use `--dry-run` to preview what it would create.

## Commands

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
```

See [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) for the format.

## Agent skill

The canonical skill is [`skills/dejavu/SKILL.md`](skills/dejavu/SKILL.md). It tells agents how to orient to the project, write handoffs, and propose lessons. Install it per project with `dejavu init --skills claude,codex` (or `all`). That copies the file to the locations each agent documents:

| Agent | Project | Personal |
| ----- | ------- | -------- |
| Claude Code | `.claude/skills/dejavu/SKILL.md` | `~/.claude/skills/dejavu/SKILL.md` |
| Codex | `.agents/skills/dejavu/SKILL.md` | `~/.agents/skills/dejavu/SKILL.md` |

For a personal install, copy the folder: `cp -R skills/dejavu ~/.claude/skills/` or `cp -R skills/dejavu ~/.agents/skills/`. Run `/skills` in either agent to confirm it was found.

## Roadmap

See the [roadmap](docs/ROADMAP.md) and [issues](https://github.com/madebyawan/dejavu/issues).

## Development

```sh
npm test
```

Tests use Node's built-in test runner, temporary directories, and sample repositories in `test/fixtures/`. See [docs/RELEASING.md](docs/RELEASING.md) for CI, versioning, and releases, and [docs/PILOT.md](docs/PILOT.md) for measurements on real repositories.

## License

MIT.
