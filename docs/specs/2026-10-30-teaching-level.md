# Spec: Per-topic teaching level

## Objective

Make the depth of generated teaching material follow the learner's stated goal and background for one topic. The control lives in the top-level Nerd Mode instruction. It adds no settings field, no settings UI, and no runtime logic. The derived value is stored in the topic's `graph.md` and passed verbatim to `study`.

## Resolved domain

**Calibration** (开课校准):
The one-time question round for a new topic. It asks for the learning goal, the learner's prior exposure, and the concepts the learner already knows well enough to skip. It runs after graph approval and before any tracker file is written. It is not evidence and changes no learner state.
_Avoid_: onboarding, interview, survey

**Teaching level**:
A self-reported pitch for one topic, with three values: `beginner`, `standard`, and `advanced`. It sets both step size and explanation detail. It says nothing about mastery, never changes a state, and never counts as evidence.
_Avoid_: learner level, proficiency, difficulty

**Teaching brief**:
The three `graph.md` lines passed verbatim to `study`: `Goal`, `Background`, and `Teaching level`. It is context for writing a lecture, not a record of what the learner knows.
_Avoid_: learner profile, learner model, settings

`standard` is the current writing standard in `skills/study/SKILL.md`. It preserves today's behavior. A missing `Teaching level` line means `standard`.

## Behavior

### Calibration

Run calibration once per new topic, after the learner approves the graph and before writing `graph.md`, `state.md`, `log.md`, or any draft.

Merge it into the existing skip question. Use one `question` call with three items:

1. What the learner wants to be able to do after studying this topic.
2. What the learner has already read, studied, or used in this area, in their own words.
3. Which concepts in the approved graph the learner knows well enough to skip, as a multi-select list.

Item 1 and item 2 are free text. Item 3 keeps the current skip behavior: each selected concept becomes `skipped`, with no date and no passes.

When the current request or the supplied material already states the goal and the background, do not ask items 1 and 2. Ask item 3 only. When the learner declines or gives no usable answer, write `Teaching level: standard` and omit the `Goal` and `Background` lines.

No later session asks again for the same topic.

### Derive the level

Use this table:

| Answers | Level |
|---|---|
| Most prerequisites are unknown, or the goal is to learn the topic from zero | `beginner` |
| Some prerequisites are known, and the goal is to understand the principles or pass an exam | `standard` |
| Most prerequisites are known, and the goal is review, reference, or use in a project | `advanced` |

The model may choose an adjacent level when the two answers clearly conflict, for example a zero-background learner who must read a paper this week. It states the reason in one line.

### Level deltas

`standard` uses the current rules unchanged.

`beginner` changes three things:

- Split the lecture into 3 to 7 numbered steps when the concept has more than one move.
- Explain each term at first use, including terms that `standard` assumes, such as a prerequisite idea or a notation convention.
- Add one worked example per step when an example helps.

`beginner` never adds a prerequisite recap block. The existing recap rule for a skipped prerequisite stays the only recap.

`advanced` changes three things:

- Use one pass without numbered steps unless the derivation needs them.
- Skip the intuition for an idea only when the `Background` line names that idea as known. Start from the formal statement.
- Use at most one example per idea, and add the qualifications and edge cases that matter for the stated goal.

### Precedence

Accuracy rules outrank the level. No level removes a symbol definition, a justification for a derivation step, a stated assumption or approximation, or a bound. No level adds filler, repeated explanation, or a section the concept does not need.

The level never changes the Recall Session, the skipped-prerequisite recap, the unseen questions, the Teach-back, the pass threshold, or any learner state. It affects the lecture only.

### Pass the brief to study

`study-plus` reads `Goal`, `Background`, and `Teaching level` from `graph.md` and passes the three lines verbatim when it loads `study` and when it writes a draft. Do not compress, summarize, or rewrite them.

`study` treats the brief as context for writing. It never reads `graph.md` or any other tracker file. The one-way dependency in `docs/adr/0008` and the current split of file ownership stay unchanged.

For a one-off `study` request with no graph, derive the level from the request and supplied material. If neither states a goal or a background, ask one combined question before teaching: what the learner wants to reach, and whether they have met the topic before. State the derived level in one line, then teach. Write no file.

### Override

A mid-topic request such as "too detailed" or "give me the conclusion" changes the level for the current session only. Do not write the change to `graph.md`, and add no log entry. A learner preference is not evidence.

When the learner says to keep the change for later, for example "use this from now on", rewrite the `Teaching level` line and keep the other two lines. This is the only path that changes an existing topic. It is also the only upgrade path for a topic that has no `Teaching level` line.

### Existing topics

Do not ask for calibration on a topic that already has a `graph.md`. A missing `Teaching level` line means `standard`. A graph rebuild keeps the existing `Goal`, `Background`, and `Teaching level` values. A rebuild asks for nothing that the previous graph already recorded.

## File format

Add two optional lines to `graph.md`, after `Goal:` and before `Book:`:

```md
# Topic: <topic>
Goal: <one line, optional>
Background: <one line, optional>
Teaching level: beginner | standard | advanced
Book: <title, optional>
```

Values are lowercase. The line is optional for existing topics. The book builder ignores unknown metadata lines, so `book-data.mjs` needs no change and the HTML Book shows neither `Background` nor `Teaching level`.

## Changes by file

- `cordis.patch.yml`: add the calibration, mapping, and brief-passing rules to the `section` text. Keep the existing routing rules.
- `skills/study-plus/SKILL.md`: add the calibration step to section 2, the `Teaching level` field to section 8, the brief handoff in section 3 and section 5, and the session-only override rule.
- `skills/study/SKILL.md`: add the three level deltas and the precedence rule. Replace the unconditional "teach until the concept is complete" with "teach until the concept is complete at the given level".
- `GLOSSARY.md`: add Calibration, Teaching level, and Teaching brief.
- `docs/adr/0014-teaching-level-in-the-topic-file.md`: record the decision.
- `README.md` and `README.zh.md`: one short paragraph on the new behavior.
- No change to `lib/index.js`, `client.js`, `state.md`, `log.md`, the assessment rules, or the Recall Session rules.
- No new settings field and no new settings group.

## Verification

- `npm test` passes unchanged. It covers no prompt text, so it cannot confirm the behavior.
- Manual check in a new topic: approve a graph, confirm one calibration call with three items, confirm the three lines are written, and confirm the first draft follows the level.
- Manual check for `beginner`: the lecture has numbered steps, defines an assumed term, and has no new prerequisite recap.
- Manual check for `advanced`: the lecture has one pass and at most one example per idea.
- Manual check for the override: a mid-topic change affects the rest of the session and does not change `graph.md`. An explicit "from now on" rewrites only the `Teaching level` line.
- Manual check for an existing topic: no calibration question, and the lecture uses `standard`.
- Manual check for one-off `study`: a request with no stated background gets one combined question, then one line naming the level.
- Run `node skills/study-plus/scripts/build-book.mjs study/<slug>` and confirm the new line does not break the Book.

## Boundaries

- Always keep accuracy rules above the level.
- Always keep the level out of learner state, evidence, and the session log.
- Always keep `study` unable to read tracker files.
- Do not add a settings field, a settings group, or a client change.
- Do not ask calibration on an existing topic.
- Do not change the number or timing of the unseen questions.
- Do not let the level add or remove a prerequisite recap.
- Do not show the level in the HTML Book.

## Success criteria

- A new topic writes `Goal`, `Background`, and `Teaching level` after one merged question round.
- The level follows the mapping table, and a conflict between the two answers is stated in one line.
- `standard` produces the same lecture style as today.
- `beginner` produces numbered steps and explains assumed terms, with no extra recap.
- `advanced` produces one pass with at most one example per idea.
- A missing `Teaching level` line means `standard`, and no existing topic is asked for calibration.
- A mid-topic change lasts only for the session. An explicit request to keep it rewrites one line.
- The one-off `study` path asks at most one combined question and writes no file.
- The HTML Book builds and shows no level.

## Open questions

None.
