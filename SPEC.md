# Study Plus and Study, v2

Two skills and one switch. `/study` guides one concept or one task and writes nothing. `/study-plus` runs a recorded session against a dated, human-readable record of what the learner has produced. The switch makes teaching the default posture of any conversation, in any mode.

Terms are defined in [GLOSSARY.md](./GLOSSARY.md). Decisions live in `docs/adr/`.

Status: v2 settled 2026-10-27, replacing both v1 presets. See ADR 0008. v2.1 moves the switch into the composer and renames the command to `/nerd-mode`. See ADR 0009.

## Non-goals

No spaced-repetition scheduler, no decay timer, no multi-learner. The lesson stays text plus SVG figures. A converted document and a one-page HTML explainer may support it, but neither replaces the lesson.

The switch edits text only. It never changes the tool set, so the request tool catalog and the prompt cache stay stable. The guide reads nothing and writes nothing.

## Delivery

Five changes, all reversible.

1. `skills/study/SKILL.md`: the guide. User-invocable, and model-invocable while the switch is on.
2. `skills/study-plus/SKILL.md`: the recorded session. Its protocol is unchanged.
3. `lib/index.js`: the switch. One session projection, one prompt section, one command.
4. `cordis.patch.yml`: a profile-level row, not a preset. It also loads the bundled `skills/` folder as a provider, so the package needs no junction root.
5. `client.js`: the composer toggle, loaded from the same package. Plain JavaScript, no build step.

Two v1 artifacts go away: the `study-skills` junction root, and both Study presets in the profile. `diagram` moves into the global skill root, where its five siblings already live. See ADR 0008.

`teach` stays: it is invoked explicitly as `/teach` and does not blend.

The recorded session mirrors `teach`, so it is explicit and never fires by accident. The guide loads by itself while the switch is on.

```yaml
name: study
description: Guide one concept or one task in steps, stopping once at a fork. Writes no file.
argument-hint: "<concept or task>"
```

```yaml
name: study-plus
description: Run one study session against a dated record of what the learner has demonstrated. Invoked as a command, never on your own.
disable-model-invocation: true
argument-hint: "<topic>, or empty to continue the last topic"
```

## The switch

One profile-level plugin, so its section reaches every agent in every preset. A preset cannot be entered after the first turn (`agent-preset/locked`), which is why the switch is not a mode.

- State: a session projection keyed `studyMode`, folded from the log's `command/run` and `command/done` events. It survives compaction, resume, and fork. No new event type is written, because an unknown stored type stops the session from reopening.
- Control: `/nerd-mode on` and `/nerd-mode off`. A bare `/nerd-mode` turns it on. The composer toggle `Nerd mode` stays visible in both states, dim when off, and sends the same command.
- Prompt: one section named `study:policy` at order 550, after the persona and after plan policy. Its text function returns the configured block only while the session's flag is on. The block opens by stating that it outranks earlier persona and style text, because an appended section cannot delete what came before.
- Scope: teaching applies to learning-shaped requests only. Explaining a concept, tutoring homework, walking through code, and exam preparation get the guided shape. Writing a feature, searching, editing config, and running commands get the normal answer.
- Not changed: the tool set. The switch edits text, so the request tool catalog and the prompt cache stay stable.
- Subagents: each runs its own session, so each starts with the switch off.

### Composer toggle

The switch sits in the composer toolbar, not the session header. It registers in `conversation.input.left` with order -1, so the row reads Full access, Nerd mode, Full Throttle. The old header entry is deleted.

- Shape: a 28px pill with a 16px book icon and the text `Nerd mode`, no status dot. The whole pill carries the state: muted when off, the theme's business color when on, the error color while a failed command is unresolved.
- Click: sends `/nerd-mode on` or `/nerd-mode off` through `ctx.remote.commands.execute`. This writes a command card into the transcript, the same way a Full access change does. A second click is ignored until the first command settles.
- Truth: the `studyMode` projection stays the only source of truth. A failed command shows the error color and never flips the pill.
- Naming: the UI, README, glossary, and command say Nerd mode. The projection key `studyMode` and the section id `study:policy` keep their names, because stored state and the host wire schema depend on them. See ADR 0009.

## The guide (`/study`)

One engine at two scales. The concept scale teaches one idea. The task scale produces one artifact, usually homework or code.

- Read nothing, write nothing. The guide never opens `study/`, so it cannot know what the record says. When the learner wants a record, the answer is `/study-plus`.
- Steps, not a wall. Order the explanation: intuition, then terms, then formal detail. Number the steps when there are more than three.
- One fork per run. Stop at the first point where more than one route changes the result, state the choice, ask one question, and wait. Do not stop again unless the answer opens a new fork.
- The model acts. For a task, produce the artifact and write the reason beside each step. The learner is not asked to type the code.
- No grading. No rubric, no pass, no miss, no log. A wrong answer gets the wrong step named and the correct route shown.
- Ending. Offer similar practice and do not impose it. Practice that needs a record belongs to `/study-plus`.

Everything below describes the recorded session, `/study-plus`. The guide writes no files, so none of it applies to `/study`.

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
- Load `writing-beats` once per session and follow its beats. The package carries a local copy with `disable-model-invocation` removed, because the global skill is manual-only.
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

1. In General mode, run `/nerd-mode on`. Ask a concept question. The answer walks steps and stops once at a fork. No file appears under `study/`.
2. Ask for a small script while the switch is on. The artifact is produced, with the reason beside each step.
3. Ask a non-learning request, such as a config edit. It is handled directly, with no teaching detour.
4. Click the `Nerd mode` pill in the composer. It goes dim, and the next answer is back to normal.
5. Restart dsh and reopen the session. The switch shows the state it had.
6. Start a subagent while the switch is on. The subagent answers normally, because it has its own session.
7. Run `/study` with the switch off. It works.
8. Run `/study-plus <topic>`. The recorded session runs as before: graph approval, five steps, four files, a dated row.
9. The mode picker shows no Study entries.

The switch needs the host services, so it has no end-to-end test. `test/client.test.mjs` stubs React and the slot registry, then asserts the slot name, order, label, and the command each click sends. The smoke test is this run, plus `npm test`, `node --check lib/index.js`, and a YAML parse of `cordis.patch.yml`.

## Open risks

- **The model grades its own questions.** Writing the rubric first reduces drift. It does not remove it. The defense is that the rubric is visible in the transcript. The bar is the validity of each stated step, not the route the tutor had in mind, so the rubric must name the conclusion and the check.
- **Graph quality.** Fifteen to thirty concepts with correct prerequisites is a hard generation task, and a wrong order quietly mis-teaches for weeks. The approval gate is the only check, so it must be a real gate.
- **`fluent` is a session claim.** See ADR 0002. A reader who adds a scheduler must add a column, not redefine the word.
- **A skip is a self-report.** See ADR 0003. It never carries a date, never counts as a pass, and a failure on a dependent concept turns it `shaky`. A skip can be taken at any time, so the queue can be emptied without evidence, and a later failure is the only check.
- **Workspace-local state splits the record.** The same topic studied in two folders produces two independent learner models. The files are plain markdown, so moving `study/<slug>/` is a copy, but nothing merges them.
- **A crashed session leaves no log block.** The `in_process` row is the only trace, it is undated, and it is the one row written for the tutor's action rather than the learner's. See ADR 0005.
- **A target can stall.** A path waits on a prerequisite the learner avoids, and nothing forces progress. The target persists until reached or cleared. See ADR 0006.
- **An appended section cannot delete a persona.** The overlay outranks earlier text by declaration, not by removal. A base mode with loud contrary rules can still leak through. The defense is the precedence sentence and a base mode that does not contradict teaching.
- **The switch widens the install surface.** A client bundle runs in the app's renderer, so a bad switch can break the composer, not just a reply. It stays plain JavaScript with no build step so the review is the whole check.
- **A subagent runs without the overlay.** Delegated research and figure work happen outside the teaching rules. That is intended, but it means a subagent can answer a learner's question in a flat voice.
- **The switch is a declaration, not a fence.** Any tool the base mode has stays available while teaching. The data-not-command rule remains the only guard on fetched text.
