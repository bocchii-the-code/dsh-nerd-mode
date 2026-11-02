# Two stale doc lines

Type: task
Status: open
Blocked by:

## Question

Two doc lines contradict the settled behaviour. Neither needs a decision, except the second one, which may fall inside the no-interface-change rule.

1. `docs/specs/2026-10-28-study-plus-v3.md:123` says a direct `/study` figure defaults to `diagrams/<topic>/`. Three later sources say `diagrams/<name>.svg` with no Course folder: `skills/study/SKILL.md:76`, `README.md:153`, `.scratch/course-folders/spec.md:55`. The accepted course-folders spec is later, so the v3 line is stale.
2. `assets/section.md:15` says only study-plus may read or write `plan.md`. `skills/study-plus/SKILL.md:31,220` and `docs/adr/0011-drafts-and-free-selection.md:9` say nothing reads or writes it and it stays on disk. This line is shown to the learner in the settings section, so editing it touches user-facing copy.

Do this: correct line 1 to the current path rule. For line 2, confirm the copy change is allowed under the map's Out of scope rule, then correct it to "a legacy `plan.md` is never read or written".

The answer records which lines changed.
