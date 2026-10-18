# Project documentation structure

Déjà Vu is not only a memory folder: it provides an opinionated, adaptable documentation architecture for teams and coding agents.

## Three layers

1. **`docs/` — source of truth:** product, design, architecture, decisions, and workstreams. GitHub Issues/PRs remain the live task tracker; docs explain enduring context.
2. **`.dejavu/` — navigable knowledge:** ontology (concepts), topology (relationships), epistemology (evidence/uncertainty), wisdom (reviewed lessons), proposals, and handoffs. Entries link back to authoritative docs and code instead of duplicating them.
3. **`AGENTS.md` and agent adapters — behavior:** short instructions to discover relevant documentation, orient to a task, and propose learning with review.

## Suggested new-project template

```text
project/
  AGENTS.md
  docs/
    00-overview/       # vision, principles, glossary
    01-product/        # requirements, user journeys
    02-design/         # UX, design system
    03-engineering/    # architecture, interfaces, security, operations
    04-decisions/      # architecture/product decision records
    05-workstreams/    # initiatives and execution plans; issues are task truth
    06-reference/      # research and external references
  .dejavu/
    README.md          # index, rules, source links
    ontology.md
    topology.md
    epistemology.md
    wisdom/
    handoffs/
    proposals/
```

## Adoption modes

- **New repo:** `init` may scaffold the documentation template and knowledge layer, after explicit selection.
- **Existing repo:** discover and index existing structures; never rename, move, or overwrite docs by default.
- **Minimal:** install only `.dejavu/` and agent entry-point instructions.

## Maintenance rules

- Avoid duplicate truths: link to the authoritative file, issue, PR, or code symbol.
- Keep status explicit: observed, inferred, proposed, accepted, superseded.
- Use concise indexes so agents can navigate without loading everything.
- Every important claim should carry evidence or be marked as an assumption.
- When work ends, update the relevant authoritative document first; propose new wisdom separately.
- Document structures are configurable: numbering and folder names are defaults, not universal requirements.

## CLI implications

`dejavu init` should offer `minimal`, `structured`, and `adopt-existing` modes; `orient` should traverse both docs and knowledge; `check` should validate links and schema without imposing one rigid layout.
