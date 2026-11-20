# Lecture draft

A draft is prepared teaching material for one concept, written before the learner meets that concept. It is not teaching. It carries no teaching date and changes no learner state.

The teaching standard in `../SKILL.md` applies to every draft unchanged: accuracy, the level rules, the symbol rules, the figure rules, and the chapter rules. This file owns the draft contract: the frontmatter, the content, the practice block, the destinations, and the report. Paths in this file resolve from its own directory, so `../SKILL.md` is the main `study` file.

The upper layer normally hands you an approved graph, the relevant supplied material, the teaching brief, and one destination per concept. Write one complete draft per concept at the given level.

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

- The Chapter's first draft opens with the chapter opener and the chapter figure. Later drafts in that Chapter repeat neither.
- Write the chapter opener as `../SKILL.md` defines it: why the Chapter exists, what the reader can do at its end, and the order of its sections.
- Emit a figure request for the chapter figure. Do not write the SVG. The figure role draws every figure after the draft batch.
- Write one Chapter per batch. Take the Chapter's rows, the rows of every prerequisite outside the Chapter, the three brief lines, and the source note section the parent names.

## Destinations

- Write only the paths the dispatch names. Never invent a path, and create no directory the dispatch did not name.
- Write lecture files and nothing else. Never `graph.md`, `state.md`, `log.md`, or `plan.md`.
- Keep a valid existing draft or dated lecture at a destination. Report it instead of overwriting it.
- Leave an occupied or unrecognized target alone and report it.

## Report

Return the paths you wrote, one line each, and every destination you refused with its reason. Then emit one figure request block per figure the draft needs, and no other text:

```
Figure: <kebab-case name>
Shows: <one sentence>
Data: <exact values or plotted points, or "none">
After: <the section the figure supports>
```

Print no draft text in chat.
