# Public repository agent guidance

This is an open-source public repository. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.

## Publication firewall (mandatory)

- Never mention, link to, identify, or expose any nonpublic repository or private project in this repository's files, documentation, tests, issues, pull requests, comments, commit messages, screenshots or logs.
- Do not include private repository names, GitHub URLs, organization identifiers, internal source paths, issue/PR IDs, implementation details, code snippets, or evaluation task descriptions in public artifacts—even when the private repository is used to test Déjà Vu.
- Use fictional project fixtures or independently verified public examples. Publish private evaluation findings only as sanitized aggregate metrics, after checking re-identification risk.
- Keep repo-specific installation guidance, knowledge compilation, and source-linked drift reports **inside the repository they describe**, respecting its access controls. Do not copy them here.
- Review generated output before any push, issue or PR. If a proposal reveals private information, redact it *before publishing*. Editing a public artifact later does not erase Git history or external caches.

## Development conventions

Preserve Déjà Vu's local-first, Git-native, model-neutral architecture. Keep the CLI dependency-light and deterministic. Existing code, ADRs, docs and issue trackers remain authoritative; derived wiki knowledge is reviewable and never promoted automatically. Run appropriate tests and report what was actually validated.
