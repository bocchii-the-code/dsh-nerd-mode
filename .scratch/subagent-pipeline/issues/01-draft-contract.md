# One canonical draft contract

Status: resolved
Blocked by: none

## Goal

The draft rules exist in one copy, and `study/SKILL.md` points at it. Today they sit inside `skills/study/SKILL.md`, so a dispatch prompt either copies them or drops them.

## Answer

Done in `d5e2f87`, on the integration branch.

- `skills/study/references/draft.md` is the contract: frontmatter, content, the practice block, Chapter batches, destinations, and the report.
- `skills/study/SKILL.md` keeps a four-line section that points at it and states that the writing standard applies unchanged.
- `skills/study-plus/references/agents/draft.md` is the two-line pointer that resolves the canonical file from the skill base directory.
- The chapter figure moved from the draft writer to the figure role: a draft emits a figure request for it instead of drawing the SVG.

## Acceptance

- `skills/study/references/draft.md` states inputs, frontmatter, practice block, destinations, and report.
- No draft rule survives in two copies. `skills/study/SKILL.md` carries a pointer only.
- `npm run check` passes.
