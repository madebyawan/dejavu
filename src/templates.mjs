// File templates written by `dejavu init`. Templates describe structure and
// rules only; they never contain project facts.

export const KNOWLEDGE_DIR = '.dejavu';

export const DOC_SECTIONS = [
  ['00-overview', 'Overview', 'Vision, principles, and glossary.'],
  ['01-product', 'Product', 'Requirements and user journeys.'],
  ['02-design', 'Design', 'UX, interaction, and design system.'],
  ['03-engineering', 'Engineering', 'Architecture, interfaces, security, and operations.'],
  ['04-decisions', 'Decisions', 'Architecture and product decision records.'],
  ['05-workstreams', 'Workstreams', 'Initiatives and execution plans. The issue tracker remains the source of truth for tasks.'],
  ['06-reference', 'Reference', 'Research and external references.'],
];

const NONE = '_None recorded yet._';

const knowledgeReadme = `# Déjà Vu knowledge

This folder is the project's navigable knowledge layer for humans and coding agents. It links to authoritative sources; it does not replace them.

## Start here

- [Project index](index.md) — links to authoritative documentation.
- [Ontology](ontology.md) — concepts and vocabulary.
- [Topology](topology.md) — systems, modules, and responsibilities.
- [Epistemology](epistemology.md) — what is known, assumed, uncertain, or superseded.
- [Wisdom](wisdom/README.md) — accepted, reviewed lessons.
- [Proposals](proposals/README.md) — unreviewed lesson candidates; not canonical.
- [Handoffs](handoffs/README.md) — concise session state.

## Rules

1. Code, specifications, decision records, and the issue tracker are authoritative. Link to them instead of copying them.
2. Every important claim carries evidence (file path, issue, PR, or permalink) or is marked as an assumption.
3. Status is explicit: observed, inferred, proposed, accepted, or superseded.
4. Agents propose; maintainers accept. Only reviewed lessons move from \`proposals/\` to \`wisdom/\`.
5. Never record secrets, credentials, or full transcripts.

Run \`dejavu check\` after editing this folder.
`;

const ontology = `# Ontology

Important project concepts and vocabulary. Link each term to the code or document that defines it.

| Term | Meaning | Source |
| ---- | ------- | ------ |
`;

const topology = `# Topology

Relationships between systems, modules, and responsibilities. Link each entry to the code or document that is authoritative for it.

| Component | Responsibility | Depends on | Source |
| --------- | -------------- | ---------- | ------ |
`;

const epistemology = `# Epistemology

What the project knows, assumes, and has not resolved. Every entry links to evidence.

## Known

${NONE}

## Assumptions

${NONE}

## Open questions

${NONE}

## Superseded

${NONE}
`;

const lessonFormat = (prefix, status) => `\`\`\`markdown
---
id: ${prefix}-0001
status: ${status}
confidence: high | medium | low
supersedes: []
superseded_by: []
---

# One-sentence summary

## Context
## Evidence
## Prevention
\`\`\``;

const wisdom = `# Wisdom

Accepted lessons: mistakes, root causes, and how to prevent them. Lessons arrive here only after a maintainer reviews a proposal.

Use one file per lesson, named \`W-NNNN-short-slug.md\`:

${lessonFormat('W', 'accepted')}
`;

const proposals = `# Proposals

Unreviewed lesson candidates. Nothing here is canonical. A maintainer accepts a proposal by moving it to [wisdom](../wisdom/README.md) and setting \`status: accepted\`.

Use one file per proposal, named \`P-NNNN-short-slug.md\`, and cite concrete evidence (bug, review, test, or PR):

${lessonFormat('P', 'proposed')}
`;

const handoffs = `# Handoffs

Concise, task-specific session state for the next agent or maintainer. Use one file per session, named \`YYYY-MM-DD-short-slug.md\`, recording:

- Task scope and current branch or PR
- Changed files
- Tests run and their results
- Unresolved issues
- Concrete next actions

Never include secrets or full transcripts.
`;

export function knowledgeFiles() {
  const dir = KNOWLEDGE_DIR;
  return [
    [`${dir}/README.md`, knowledgeReadme],
    [`${dir}/ontology.md`, ontology],
    [`${dir}/topology.md`, topology],
    [`${dir}/epistemology.md`, epistemology],
    [`${dir}/wisdom/README.md`, wisdom],
    [`${dir}/proposals/README.md`, proposals],
    [`${dir}/handoffs/README.md`, handoffs],
  ];
}

export function docsFiles() {
  const index = [
    '# Documentation',
    '',
    'Enduring project context. The issue tracker remains the source of truth for tasks; code remains the source of truth for behavior.',
    '',
    ...DOC_SECTIONS.map(([dir, title, purpose]) => `- [${title}](${dir}/README.md) — ${purpose}`),
    '',
  ].join('\n');

  const sections = DOC_SECTIONS.map(([dir, title, purpose]) => {
    let body = `# ${title}\n\n${purpose}\n`;
    if (dir === '04-decisions') {
      body += '\nUse one file per decision, named `NNNN-short-title.md`, with Status, Context, Decision, and Consequences sections. Supersede decisions instead of rewriting them.\n';
    }
    return [`docs/${dir}/README.md`, body];
  });

  return [['docs/README.md', index], ...sections];
}

export function agentsPointer({ structured }) {
  const docsLine = structured ? '\n   Enduring documentation lives in [docs/](docs/README.md).' : '';
  return `# Agent instructions

This repository keeps project knowledge with [Déjà Vu](https://github.com/madebyawan/dejavu).

1. Read [.dejavu/README.md](.dejavu/README.md) and the [project index](.dejavu/index.md), then follow only the links your task needs.${docsLine}
2. Treat code, specifications, decision records, and issues as authoritative. Verify time-sensitive claims.
3. Propose lessons in \`.dejavu/proposals/\` with evidence. Never promote them to \`.dejavu/wisdom/\` yourself.
`;
}

export const claudePointer = `# Claude Code instructions

Project instructions live in [AGENTS.md](AGENTS.md).

@AGENTS.md
`;

export const AGENTS_HINT = 'Read .dejavu/README.md and .dejavu/index.md before starting a task.';
