# 02 — Guide figure path and vocabulary

Status: ready-for-agent

## Question

Point the guide skill at the Course folder for a scoped figure, keep a one-off lesson free of record folders, and drop the word topic from its text.

## Scope

Read the spec at `.scratch/course-folders/spec.md`, sections **Figures**, **Vocabulary**, and **Layout**.

Edit only `skills/study/SKILL.md`.

1. In **Files and figures**, replace `diagrams/<topic>/<name>.svg` with two rules:
   - when the upper layer scopes a Course, write `study/<course>/diagrams/<name>.svg`;
   - when the guide runs alone, write `diagrams/<name>.svg`, with no Course folder.
2. Sanitize `course` and `name` as single lowercase kebab-case segments with no slashes and no dot segments. Keep the existing fallback and the containment check.
3. Replace the forbidden-path sentence `study/<topic>/graph.md`, `state.md`, `log.md`, `plan.md` with the same four files under `study/<course>/`.
4. Replace the remaining "topic" mentions with Course where they name the record, including the calibration sentence that talks about deriving the level for one-off requests.
5. Leave the draft-writing section alone. Its destinations come from the upper layer and already carry the full path.

## Tests

- `node --test test/prompt-consistency.test.mjs` passes.
- `git grep -n 'diagrams/<topic>' skills/study/SKILL.md` returns nothing.

## Acceptance

- A standalone `/study` session writes figures at `diagrams/<name>.svg` and creates no folder under `study/`.
- A scoped figure lands in `study/<course>/diagrams/`, never inside `lectures/`.
