# 02 - Calibration and brief handoff

Status: resolved
Blocked by: none

## Question

Make `skills/study-plus/SKILL.md` run one calibration round for a new topic, write the three brief lines to `graph.md`, pass them to `study` verbatim, and handle the session-only override.

## Scope

Read the spec at `.scratch/teaching-level/spec.md`, sections **Behavior**, **File format**, and **Changes by file**. Edit only `skills/study-plus/SKILL.md`.

1. Section 2, new topic: replace the standalone skip question with one calibration `question` call holding three items: the goal, the prior exposure, and the multi-select skip list. Keep the skip behavior: each selected concept becomes `skipped`, with no date and no passes. Keep the existing graph approval step and do not add another approval step.
2. When the current request or the supplied material already states the goal and the background, ask item 3 only. When the learner declines or gives no usable answer, write `Teaching level: standard` and omit the `Goal` and `Background` lines.
3. Add the level mapping table as rules. Allow an adjacent level when the two answers clearly conflict, with the reason stated in one line.
4. Section 8: add `Goal`, `Background`, and `Teaching level` to the `graph.md` format block, in the order `# Topic`, `Goal`, `Background`, `Teaching level`, `Book`. Values are lowercase. The line is optional for existing topics.
5. Section 3 and section 5: pass the three lines verbatim to `study` when loading it and when writing a draft. Do not compress, summarize, or rewrite them.
6. Add the override rule: a mid-topic "too detailed" or "give me the conclusion" changes the level for the current session only, writes nothing to `graph.md`, and adds no log entry. Only an explicit "from now on" rewrites the `Teaching level` line and keeps the other two lines. It is the only upgrade path for a topic with no `Teaching level` line.
7. Existing topics: never ask calibration when a `graph.md` exists. A missing `Teaching level` line means `standard`. A graph rebuild keeps the existing three values and asks for nothing already recorded.
8. Keep every existing rule. The level never changes the Recall Session, the skipped-prerequisite recap, the unseen questions, the Teach-back, the pass threshold, or any learner state.

Do not edit `lib/index.js`, `client.js`, `state.md`, `log.md`, or `book-data.mjs`. Do not show the brief in the Book.

## Acceptance

- One calibration call with three items replaces the skip question for a new topic.
- The three lines are written in the stated order and the levels are lowercase.
- The brief handoff is stated in section 3 and section 5.
- The session-only override and the single rewrite path are unambiguous.
- No existing rule is dropped.
- `npm test` passes unchanged.

## Answer

Resolved in `skills/study-plus/SKILL.md`, commit b553502, tightened in ca97750. Section 2 step 5 runs calibration as one three-item call, followed by the mapping table, the conflict escape, the decline path, the existing-topic rule, and the override rule. Section 3 and section 5 pass the brief verbatim. Section 8 shows the three lines in order and states that they are optional and lowercase.
