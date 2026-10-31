# 01 - Study level deltas

Status: resolved
Blocked by: none

## Question

Make `skills/study/SKILL.md` teach at the three teaching levels, without changing anything else it owns.

## Scope

Read the spec at `.scratch/teaching-level/spec.md`, sections **Resolved domain**, **Level deltas**, and **Precedence**. Edit only `skills/study/SKILL.md`.

1. Add `beginner` deltas: split the lecture into 3 to 7 numbered steps when the concept has more than one move, explain each term at first use including terms `standard` assumes, and add one worked example per step when an example helps.
2. State that `beginner` never adds a prerequisite recap block, and that the existing skipped-prerequisite recap stays the only recap.
3. Add `advanced` deltas: one pass without numbered steps unless the derivation needs them, skip the intuition for an idea only when the `Background` line names that idea as known, and at most one example per idea while keeping the qualifications and edge cases that matter for the stated goal.
4. Add the precedence rule: accuracy rules outrank the level. No level removes a symbol definition, a derivation-step justification, a stated assumption or approximation, or a bound. No level adds filler, repeated explanation, or a section the concept does not need.
5. State that `standard` is today's standard unchanged, and that a missing `Teaching level` means `standard`.
6. In the lecture-drafts section, accept the three-line teaching brief as context. Keep every existing rule: `study` never reads `graph.md` or any other tracker file, and a draft changes no learner state.
7. Replace the unconditional "teach until the concept is complete" wording in this file, if present, with "teach until the concept is complete at the given level". The matching phrase in `skills/study-plus/SKILL.md` belongs to ticket 02, not here.
8. For a one-off request with no graph, derive the level from the request and supplied material. When neither states a goal or a background, ask one combined question before teaching. State the derived level in one line, then teach. Write no file.

Do not mention states, passes, misses, question counts, or the log in a level rule. Do not add a settings field.

## Acceptance

- The file names all three levels and states what each one changes.
- The precedence rule appears in one place, not scattered.
- Every existing rule in the file still holds.
- `npm test` passes unchanged.
- Prose matches the terse imperative voice already used in the file.

## Answer

Resolved in `skills/study/SKILL.md`, commit b553502, tightened in ca97750. A new section "Teach at the given level" carries the `standard` no-change rule, the `beginner` deltas, the `advanced` deltas, the precedence paragraph, and the one-off path. The draft section now accepts the brief and says "at the given level". `study` still reads no tracker file.
