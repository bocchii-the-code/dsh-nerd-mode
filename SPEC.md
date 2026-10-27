# study-plus, v1

A dsh skill that runs a study session against a dated, human-readable record of what the learner has actually produced.

Terms are defined in [GLOSSARY.md](./GLOSSARY.md). Decisions live in `docs/adr/`.

Status: skill, junctions, and preset persona installed 2026-10-25. The preset widened the same day: three skills, delegation, a general shell, and unrestricted writes. Restart dsh, then run the acceptance test.

## Non-goals

No spaced-repetition scheduler, no decay timer, no UI panel, no multi-learner, no plugin bundle. The lesson stays text plus SVG figures. A converted document and a one-page HTML explainer may support it, but neither replaces the lesson.

## Delivery

Five changes, all reversible.

1. `~/.agents/skills/study-plus/SKILL.md`: the protocol. The only source of truth for the prompt.
2. A directory junction `~/.dsh/study-skills/study-plus` pointing at that folder, the same wiring `teach` uses. No skill-root edit is needed, and adding the global root instead would load roughly 120 unrelated skills into every session.
3. Remove the junction `~/.dsh/study-skills/tutor`. Two teaching protocols in one preset blend into neither. The `tutor` skill file is untouched and the junction can be restored.
4. The Study mode persona in `~/.dsh/profiles/desktop/cordis.patch.yml`: point it at `/study-plus`, keep the study files in `study/<topic>/` in the workspace, and mirror the skill's teaching rules so a casual explanation keeps the same quality. Without this, the persona tells the model to load a missing skill and forbids the files a session must write.

5. Three more skills join the study root as junctions: `humanizer`, `convert-documents-to-markdown`, and `answer-me-with-html`. The preset also gains `delegation`, a general shell rule, and permission to write outside the topic. The lesson format does not change. See ADR 0007.

`teach` stays: it is invoked explicitly as `/teach` and does not blend.

Skill frontmatter mirrors `teach`, so the skill is explicit and never fires by accident:

```yaml
name: study-plus
description: Run one study session against a dated record of what the learner has demonstrated. Invoked as a command, never on your own.
disable-model-invocation: true
argument-hint: "<topic>, or empty to continue the last topic"
```

## Per-topic workspace

`study/<topic-slug>/` in the current workspace holds four files. They are markdown because nothing parses them but the model, and markdown has no syntax a bad write can break.

The skill locates the record with a recursive glob of `study/**` from the workspace root. A one-level `study/*` glob or a directory read can return empty while the record exists, so a single empty result must never be read as "no record".

`graph.md`: built once, changed only on request.

```md
# Topic: Shampoo and Adam optimizers
Goal: read the Shampoo paper without hand-waving the preconditioner.

| # | Concept | Definition | Prerequisites |
|---|---|---|---|
| 1 | stochastic gradient descent | ... | - |
| 2 | per-coordinate scaling in Adam | ... | 1 |
```

`state.md`: one row per concept, dated when there is evidence.

```md
| # | Concept | State | Last evidence | Passes | Misses | Note |
|---|---|---|---|---|---|---|
| 1 | stochastic gradient descent | fluent | 2026-10-25 | 2 | 1 | confused momentum with step size |
```

The states are `new`, `shaky`, `fluent`, `skipped`, and `in_process`. A `skipped` row carries no date and no passes. It records a self-report, at graph approval or at any later point when the learner says so, and the tutor never treats it as evidence.

`in_process` records a session that stopped after the lecture, before the questions. The tutor writes it at the start of Teach, only from `new`, and the next verdict clears it. It carries no date, satisfies no prerequisite, and is the one state that is not evidence. See ADR 0005.

The date column exists because there is no scheduler. Whenever the tutor relies on `fluent`, it must state the date. If it cannot, it says the date is unknown instead of implying freshness.

`log.md`: appended once per session, six lines maximum. Each block records the concept, what was asked, what failed, and what was decided next.

`plan.md`: one target, written as `Target: 7 matrix square root`, or `Target: -` when none is set. It is created at graph approval and changes only when the learner names a target or reaches one.

## Session spine

Exactly these five steps, in order.

1. **Recall.** Read the four files. Ask one question about the most recent concept with a verdict, from any earlier session, cold, no hints. A wrong answer marks that concept `shaky` and is dated. Never recall the concept this session teaches. Skip the step when no concept has a verdict.
2. **Teach.** Write the row as `in_process` before the first paragraph, only from `new`. Teach one concept in layers: intuition, then terms, then formal detail, to completion. If the row was already `in_process`, say that the last session stopped before the questions, repeat the full lecture, then ask the questions.
3. **Unseen questions.** Three per concept. Write the expected answer and the marking criteria before asking. Ask one at a time and wait. Two correct is a pass, where correct means the conclusion holds and no stated step is wrong. A different valid route is correct. A wrong answer never blocks the session: name the wrong step, work the correct answer with its process, mark one miss, then ask a similar question. A learner who defers a question moves on at once, and the defer is recorded.
4. **Teach-back.** Ask for an explanation to someone who has not seen the idea. Grade two things: the idea is correct, and the explanation would let that person use it. Plain language is a note. Do not ask where the idea stops applying. A gap in an answer that is valid overall is named and corrected, not counted as a miss.
5. **Record.** Update the row: state, today's date, passes, misses, one short note. A verdict clears `in_process`. Append the log block. If the concept was the target and is now fluent, clear the target, state the evidence date, and ask what comes next. Otherwise name the next concept and the reason in one line.

One concept per session by default. The learner can ask for another.

## Presentation

The Teach step is a lecture, not a summary.

- Open with a title that names the idea, never the session or the date.
- Number the headings and name each after its content.
- No length cap. Teach until the concept is complete by the tutor's judgment, and send one message.
- Load `writing-beats` once per session and follow its beats. The preset carries a local copy with `disable-model-invocation` removed, because the global skill is manual-only.
- Three or more symbols get a short table before the first formula.
- A figure lives at `study/<slug>/diagrams/<name>.svg` and is referenced from the workspace root. The client escapes inline SVG, so the file must exist on disk before the message renders.
- Every plotted point is computed with pwsh, never placed by eye.
- `tool-pwsh` exists for figure geometry only.

## Steering

With no target, pick the lowest-numbered **ready** concept: prerequisites all fluent or skipped, the concept itself neither fluent nor skipped. If an `in_process` concept and a lower-numbered `new` concept are both ready, name the lowest of each and let the learner choose. If every concept is skipped, ask which one to start with. If no concept is ready otherwise, take the concept with the oldest evidence.

With a target, follow its **path**: the target plus every prerequisite not yet fluent or skipped, in graph order. The lowest unfinished concept on the path is next. The rules for a session without a target do not apply.

The learner sets a target by naming a concept they want to reach. The tutor maps a loose name to the nearest concept, confirms with one question, and writes `Target:` in `plan.md`. One target at a time. It survives a restart, and a rebuild clears it. When the target becomes fluent, the tutor sets `Target: -`, states the evidence date, and asks whether to go deeper, name a new target, or continue with the next ready concept.

A skipped prerequisite gets one line of recap before the lesson, and a later failure turns it `shaky`. State the choice and the reason in one line, then start. The learner can veto. A veto is recorded, because repeated vetoes mean the graph's order is wrong, not that the learner is difficult. A veto on a path concept pauses the target for the session and takes the next ready concept. The path resumes next session.

## Grading and pushback

- Write the rubric before the question, not after the answer.
- Hold the grade. Restate it once with the reason, never agree with a wrong step, record the disagreement, continue. No debate.
- When the learner asks for the answer outright: give it with its process, mark a miss with the date, then ask a similar question. The record is what keeps this honest, not refusal.
- A wrong answer, an answer request, and a deferred question all move the session forward. None of them ends it.
- Self-report is not evidence. "I know this" may only add a note.

## Sources

The graph builder mixes three tiers for a better narrative, in this order of weight: material the learner provided, credible web sources (papers, official docs, primary datasets), then model knowledge.

- Synthesize across them. Do not present three separate voices.
- When they disagree in a way that changes the lesson, show the disagreement in one line and teach the stronger evidence.
- Name the source for load-bearing numbers, definitions, and causal claims. No inline citation on every sentence.
- Never fill a gap silently. Say what is unknown.

## Acceptance test

1. Switch to the Study mode preset and run `/study-plus Shampoo and Adam optimizers`.
2. It offers a graph of 15-30 concepts with prerequisites and waits for approval. Edit one row to prove the gate works.
3. Run one complete session on the first ready concept.
4. Name a concept that has at least one unfinished prerequisite. The tutor confirms the target, writes `plan.md`, and teaches the lowest unfinished prerequisite, not the lowest-numbered concept overall.
5. `study/shampoo-and-adam/` in the workspace contains `graph.md`, `state.md`, `log.md`, and `plan.md`, with a dated row.
6. Start a session and stop after the lecture, before the questions. The row reads `in_process`, with no date. Restart dsh. The next session repeats the lecture and then asks the questions.
7. After a graded session, restart dsh. `/study-plus` still resolves and the state survives.
8. Ask for a one-page visual explainer of one concept. The tutor loads `answer-me-with-html`, writes the page, and names the path.
9. The observable advantage over ChatGPT: it names the next concept, the reason, and the date of the evidence behind it. ChatGPT cannot name any of the three.

No code means no lint or unit test. The smoke test is this run, plus a read-back of the four files to confirm the tables are intact.

## Open risks

- **The model grades its own questions.** Writing the rubric first reduces drift. It does not remove it. The defense is that the rubric is visible in the transcript. The bar is the validity of each stated step, not the route the tutor had in mind, so the rubric must name the conclusion and the check.
- **Graph quality.** Fifteen to thirty concepts with correct prerequisites is a hard generation task, and a wrong order quietly mis-teaches for weeks. The approval gate is the only check, so it must be a real gate.
- **`fluent` is a session claim.** See ADR 0002. A reader who adds a scheduler must add a column, not redefine the word.
- **A skip is a self-report.** See ADR 0003. It never carries a date, never counts as a pass, and a failure on a dependent concept turns it `shaky`. A skip can be taken at any time, so the queue can be emptied without evidence, and a later failure is the only check.
- **Workspace-local state splits the record.** The same topic studied in two folders produces two independent learner models. The files are plain markdown, so moving `study/<slug>/` is a copy, but nothing merges them.
- **A crashed session leaves no log block.** The `in_process` row is the only trace, it is undated, and it is the one row written for the tutor's action rather than the learner's. See ADR 0005.
- **A target can stall.** A path waits on a prerequisite the learner avoids, and nothing forces progress. The target persists until reached or cleared. See ADR 0006.
- **The widened preset removes the tool fence.** General shell, delegation, and writes anywhere mean fetched content can reach a command or a file outside the topic. The persona's data-not-command rule is the only guard. See ADR 0007.
