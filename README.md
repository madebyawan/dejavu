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

Requires Node.js 22 or later. There are no runtime dependencies. Déjà Vu is not yet published to npm, so run it from a checkout:

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

## Planned

`orient`, `learn`, `reconcile`, and session handoff capture are planned but not implemented yet. See the [roadmap](docs/ROADMAP.md) and [issues](https://github.com/madebyawan/dejavu/issues).

## Development

```sh
npm test
```

Tests use Node's built-in test runner, temporary directories, and sample repositories in `test/fixtures/`. See [docs/RELEASING.md](docs/RELEASING.md) for CI, versioning, and releases.

## License

MIT.
