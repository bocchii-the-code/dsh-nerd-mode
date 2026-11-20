# Lecture draft

A draft is prepared teaching material for one concept, written before the learner meets that concept. It is not teaching. It carries no teaching date and changes no learner state.

The teaching standard in `../SKILL.md` applies to every draft unchanged: accuracy, the level rules, the symbol rules, the figure rules, and the chapter rules. This file owns the draft contract: the frontmatter, the content, the practice block, the destinations, and the report. Paths in this file resolve from its own directory, so `../SKILL.md` is the main `study` file.

The upper layer normally hands you an approved graph and one destination per concept. Write one complete draft per concept at the given level.

## Inputs

- The concept's row: number, name, one-line definition, prerequisites.
- The three brief lines: `Goal`, `Background`, and `Teaching level`, verbatim.
- The relevant supplied material, and the Chapter's section of the source note at `study/<course>/sources.md`.
- One destination path per concept.
- For a chapter batch: the Chapter's rows, the rows of every prerequisite outside the Chapter, and whether this is the Chapter's first draft.

## Frontmatter

```md
---
status: draft
concept: 3
---

# <concept name>
```

`status` is exactly `draft` and `concept` is the graph's concept number. Add no date. The body opens with one H1, named for the concept.

## Content

- Cover the concept completely at the given level: the teaching explanation, its relationships, and useful examples.
- Write the concept, not a summary of it. A reader who has the draft and nothing else can perform the concept's outcome.
- Follow the Chapter's section order when the graph gives one.
- Apply the level rules in `../SKILL.md` at the given level. No level removes a symbol definition, a justification for a derivation step, a stated assumption or approximation, a bound, or a figure the concept needs.

## The practice block

End the draft with one practice block: two to four exercises, each with a reasoned answer.

- Mark the block as ungraded practice.
- Give every item a reasoned answer that walks the step which matters, not an answer key line.
- Write no grading criteria.
- These items never become a graded question and never count as evidence.

## Chapter batches

When the parent splits the work by Chapter:

- The Chapter's first draft carries the chapter opener and the chapter figure in its first section: the image line `![<caption>](../diagrams/<name>.svg)` and one caption sentence. Later drafts in that Chapter repeat neither.
- Write the chapter opener as `../SKILL.md` defines it: why the Chapter exists, what the reader can do at its end, and the order of its sections.
- Emit a figure request for the chapter figure with the same `<name>`. Do not write the SVG and do not create `../diagrams/`. The file may not exist while the draft is written; the figure role draws it after the draft batch.
- Write one Chapter per batch.

## Destinations

- Write only the paths the dispatch names. Never invent a path, and create no directory the dispatch did not name.
- Write lecture files and nothing else. Never `graph.md`, `state.md`, `log.md`, or `plan.md`.
- Keep a valid existing draft or dated lecture at a destination. Report it instead of overwriting it.
- Leave an occupied or unrecognized target alone and report it.

## Report

Use the header report shape. Put every written path on a `Wrote` line, every refused destination on a `Refused` line with its reason, and anything the parent must decide, such as an ambiguous figure request, on a `Judge` line.

Below `Judge`, emit one figure request block per figure the draft needs, and no other text:

```
Figure: <kebab-case name>
Shows: <one sentence>
Data: <exact values or plotted points, or "none">
After: <the section the figure supports>
```

Print no draft text in chat.
