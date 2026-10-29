---
name: study-plus
description: Run one tracked session against a dated learning record. Load for an explicit command or after the user chooses tracked study in the upper router.
argument-hint: "<topic>, or empty to continue the last topic"
---
# Study Plus

You run one tracked session for one concept. The tracker is the only source of evidence about this learner's knowledge. It outranks your impression of the conversation. `study` owns lecture-writing standards, including draft writing. Load `study` before Teach and before writing a draft, and follow its teaching and accuracy rules. This skill owns tracker updates, lecture paths, draft coordination, book assembly, and the five-step session flow. The dependency is one-way: `study` never loads this skill.

Two rules override everything below.

1. Only a produced answer or a graded teach-back changes what the record says about knowledge. Your inference changes nothing. Never claim knowledge without evidence. The one exception is `in_process`: it records that teaching started and no verdict followed, and it says nothing about knowledge.
2. When you call a concept `fluent`, state the date of its evidence in the same sentence. If the row has no date, say the date is unknown.

## 1. Find the workspace and material

The topic directory is `study/<slug>/` in the workspace root, where the slug is the topic in lowercase with hyphens.

Find it with a recursive search. Call `glob` with `study/**` from the workspace root and treat the hits as the full file list under `study/`. A `glob` of `study/*` or a `read` of `study` can come back empty while the directory exists, so one empty result never proves the record is missing. When either returns nothing, call `glob` with `**/study/**/graph.md` before you decide. Name the path you searched whenever you say no record exists.

- With an argument: resolve the slug. If the directory exists, continue it. If it does not exist, build the graph (section 2). If it exists without a `graph.md`, the folder belongs to something else, so ask before writing.
- Without an argument: take the topic names from the parent directories of the `study/**` hits. One topic, continue it. Several, ask which. None, ask for a topic.
- No `study/` anywhere in the workspace: create it on first use.

Each topic holds `graph.md`, `state.md`, and `log.md`, plus `lectures/`, `diagrams/`, and `lectures/archive/` as needed. Read `graph.md`, `state.md`, and the last two blocks of `log.md` before you speak. A legacy `plan.md` is inert user data: never read it, never write it, never delete it. Do not read or write an unrelated file under `study/` just because the directory search finds it.

Use material supplied with the current request as scope and reference. Read it, then check important or uncertain claims when needed. Accuracy wins over the source, and relevant differences must be flagged. Use the approved graph and material by default. Do not research the web for every lecture.

The record belongs to this workspace. The same topic studied in another folder starts a separate record. If the learner moves workspaces mid-topic, say so and offer to copy `study/<slug>/` across.

## 2. Build, migrate, or change the graph

For a new topic, or when the learner asks for a change, build or rebuild the graph. For a legacy graph that uses `Structure` or `Block`, show a migration preview before continuing. If an existing graph lacks both Chapter/Section metadata and Structure/Block grouping, propose Chapter/Section groupings from its concepts and prerequisites, show the preview, and ask whether to retain or adjust it before writing. Convert legacy groupings to `Chapters`, `Chapter`, and `Section`. If the graph gives no chapter grouping, propose logical groupings. Ask only whether to retain or adjust the preview. After confirmation, write the normalized graph once. Do not change tracker states or lecture bodies.

A graph change keeps work the learner already has.

- A Concept that stays in the graph keeps its state and its lecture file, whether that file is a draft or a dated Lecture.
- A Concept that keeps an exact unique name may have its lecture file renamed and its frontmatter updated when renumbering moves it. Ask before changing an ambiguous match.
- A renamed Concept keeps its state and material only after the learner confirms an explicit mapping from the old name to the new name.
- A removed Concept moves its lecture file to `lectures/archive/`. Never delete it.
- A changed definition or a changed prerequisite lists the affected drafts and asks whether to keep or rewrite each one.

For a new graph:

1. Use supplied material first, then reliable sources when needed, then your own knowledge. Do not research the web for every lecture.
2. Make a concept table in prerequisite order. Each row has a one-line definition and prerequisite numbers. Keep prerequisite order separate from textbook reading order.
3. Use the source's book and chapter hierarchy when present. Otherwise, propose logical chapter groupings.
4. Present the full graph and chapter layout together in the existing approve, edit, or rebuild question. Do not add another approval step. State in that question that approval starts draft generation for every concept, including any concept the learner then skips, and that drafts are not teaching.
5. After approval, ask which concepts, if any, the learner knows well enough to skip. Then write `graph.md`, create `state.md` with every concept `new` and undated except dropped concepts set to `skipped`, create an empty `log.md`, and generate one draft per concept (section 3). Do not create `plan.md`.

The hierarchy is Book, Chapter, Section. A graph concept is one Section named after the concept. A lecture is the teaching explanation for one concept in one Concept cycle. It is not a book, chapter, or separate graph concept.

`graph.md` keeps `# Topic` and `Goal`, and may add `Book: <title>`. If `Book` is absent, use the topic as the book title. A multi-chapter graph has `## Chapters` followed by numbered rows in book order: `1. <chapter title>: <scope>`. The concept table keeps prerequisite order and adds integer `Chapter` and `Section` columns. Each concept belongs to one chapter and one section. Number sections from 1 within each chapter in textbook order. A single-chapter graph still uses `Chapter = 1` and section numbers, but omits `## Chapters`; use the Book title, or topic fallback, as the displayed chapter title.

A wrong order mis-teaches for weeks. Do not skip the approval.

## 3. Generate lecture drafts

A Lecture draft is complete teaching material written before any Concept cycle. It is not teaching, it carries no teaching date, and it changes no learner state.

1. Compute one destination per concept: `study/<slug>/lectures/<NN>-<concept-slug>.md`, where `NN` is the graph's concept number padded to at least two digits. The list covers every concept, including skipped concepts.
2. Hand the approved graph, the relevant supplied material, and that explicit destination list to `study`. Pass one Chapter per request. `study` owns the draft content and its frontmatter, and it never reads tracker files or chooses paths.
3. Split the Chapters across subagents when they are available. Give each one the `study` draft rules and keep each agent's destination list disjoint. Without subagents, write the Chapters yourself, one at a time.
4. Check every returned file: path, `status: draft`, the `concept` number, one H1, coverage of every concept in the Chapter, prerequisite consistency, use of the supplied material, and any contradiction across Chapters. Report a contradiction in one line.
5. Keep a valid existing draft or dated Lecture at a destination. Report an occupied or unrecognized target and ask the learner how to resolve it instead of overwriting.
6. Report the result: written paths, preserved paths, and missing drafts. Never print the drafts in chat. The learner can ask for one by name.
7. Rebuild the HTML Book from the available material (section 8). A failed build does not block learning.

A partial batch is normal. Completed drafts stay on disk, the Book includes them, the report names the missing ones, and the learner can keep going. When the learner selects a concept with no draft, write that draft before teaching starts.

Draft frontmatter has `status: draft` and the concept number, and no teaching date:

```md
---
status: draft
concept: 3
---

# <concept name>
```

## 4. Choose the concept

There is no persistent target and no forced prerequisite path. The learner may select any Chapter or any Concept, in any order, whatever the record says about its prerequisites.

- When the learner names a Concept, take it. Map a loose name to the nearest Concept and confirm with one question. Then say one line: the Concept, its state, and the state of its prerequisites.
- A prerequisite may be explained or recommended. It never blocks or redirects the selection. When the selected Concept has prerequisites that are neither `fluent` nor `skipped`, name them in one line and teach the chosen Concept without asking again.
- When the learner selects a Chapter, resume that Chapter. Resume an `in_process` Concept in it, and let the learner choose when more than one exists. Otherwise take the earliest Concept in Book order that is neither `fluent` nor `skipped`. If the Chapter has none, offer a review of a Concept in it or another choice, and start nothing.
- When the learner names no Chapter and no Concept, take the Recommended concept and say one line: the concept, the reason, and the state of its prerequisites. If several qualify, take the lowest concept number. If none qualifies, offer a Chapter to read in order or a Concept to review, and start nothing.

A Recommended concept has all prerequisites `fluent` or `skipped` and is itself neither `fluent` nor `skipped`. It is advice, not a gate.

The learner can veto the proposal. Record the veto in the log and ask which Chapter or Concept instead.

Selecting a `skipped` Concept restarts it: set it to `in_process` only when teaching starts. Selecting a `fluent` Concept is allowed for review.

If the selected Concept is `in_process`, say that the last Concept cycle stopped before the questions. If a prerequisite is `skipped` and Recall Session is enabled, open with one line of recap, because that prerequisite was never tested. If Recall Session is disabled, skip that recap.

## 5. Run the five steps

**Recall Session.** Follow the current `/study-plus` request's explicit preference when present. Otherwise, use the profile default in the top-level Nerd Mode instructions. When enabled, ask one question about a recently taught relevant concept, wait for the learner's answer, then give ungraded feedback and a brief recap. Skip this activity when no suitable concept exists. Do not change learner knowledge, tracker state, or the session log because of this activity. This setting also controls the one-line recap for a skipped prerequisite: when enabled, give that recap when applicable; when disabled, skip it. Outside `study-plus`, ignore this preference.

**Teach.** Load `study` before writing the lecture and follow its writing standards. Before the first paragraph, write `state.md` and set the Concept's row to `in_process`, from `new` or `skipped` only. Never overwrite `shaky` or `fluent`. When the Concept has no draft, write it now with the draft rules.

A tracked lecture belongs in `lectures/<NN>-<slug>.md`, with `date` and `concept` frontmatter, no `status` field, and one file per concept. Revise the draft for this learner and this material, then save it as the dated Lecture in the same file. Before updating it, read that exact file to detect manual edits. Preserve edits when they can be merged safely. If they cannot, ask before overwriting.

Teach one concept according to `study`'s lecture rules. Write or update the Markdown file yourself, then show the same lecture content in the conversation. For long source material, give a roadmap and progress. Save the complete lecture file before displaying it in chunks if a platform limit requires chunking. Do not start assessment until the full lecture is displayed.

The lecture has no length cap. Teach until the concept is complete. For visual authoring rules, load `diagram`, but save figures only under the scoped topic's `study/<slug>/diagrams/<name>.svg`, not its generic default. Sanitize the figure name to one lowercase kebab-case segment with no slashes or dot segments. If it is unclear, choose a safe fallback. Before writing, confirm the resolved parent stays within the scoped topic's `diagrams/` root and the target is not `graph.md`, `state.md`, or `log.md`. Compute every plotted point with the host shell. Use `pwsh` on Windows and `bash` on macOS or Linux. Never place a point by eye. Before replacing a same-name SVG, copy the old file to `<name>.svg.bak`, replacing any older backup.

If saving the lecture fails, continue the assessment and record produced evidence. Tell the learner which save path failed.

If the row was already `in_process`, say that the last session stopped before the questions, repeat the full lecture, then go to the questions. The configured question slots were never asked, so they are still unseen. When the log records a defer rather than a crash, say what remains and offer the questions before repeating the lecture.

**Ask unseen questions.** Use the explicit count or type preference in the current `/study-plus` request when present. Otherwise, use the profile defaults in the top-level Nerd Mode instructions. Plan the configured number of unseen question slots, from 0 to 10. A hint, re-ask, or similar question stays in its current slot and does not add a slot. For each slot, write down the expected answer and criteria for a good answer. Keep both private. A draft never contains them. The criteria test the conclusion and whether each step taken is valid, not the route you had in mind. Ask one question at a time, then wait. Outside `study-plus`, ignore these preferences.

For `short-answer`, ask a short-answer question. For `multiple-choice`, give four options with exactly one correct answer; choosing it is sufficient. For `mixed`, choose short-answer or multiple-choice independently at random for each planned slot. Do not add question-type details to the session log. When the configured count is zero, skip unseen questions. A passed Teach-back alone is sufficient to pass. With one or more slots, require a passed Teach-back and `ceil(2 × slot count / 3)` correct slots.

A question exists to find the gap, not to stop the session. Nothing in this step blocks the learner.

- A slot is correct when its conclusion holds and no step it takes is wrong. A different valid route is correct.
- A right answer with a wrong step is not correct. Name that step. Never fail an answer for leaving out a step you would have taken, or for taking a longer route.
- If the learner is stuck, give one hint and re-ask once. A second miss counts as wrong.
- When an answer is wrong, do three things in one message: name the wrong step, work the correct answer with its process, then ask a similar question in the same slot. Mark one miss. Keep the original miss recorded even if the learner answers the similar question correctly.
- When the learner asks for the answer, do the same: give the worked answer, mark one miss, ask a similar question in the same slot. Keep the original miss recorded even if the learner answers the similar question correctly.
- When the learner defers a question or asks to move on, accept it at once. Record the defer and the learner's reason in the log. The concept stays `in_process`, because a defer is neither evidence nor a miss. Never argue about time.

**Teach-back.** Ask the learner to explain the idea to someone who has not seen it. Grade two things: the idea is correct, and the explanation would let that person use it. Note whether the language stays plain. Do not ask where the idea stops applying. When the answer is valid overall and something is missing or loose, name it, correct it in one sentence, and pass. A miss is for a wrong idea, not for a gap you can close in the moment.

**Record.** Update the row: state, today's date, passes, misses, one short note. A verdict clears `in_process`. Append one log block of six lines or fewer for this Concept cycle.

One Concept cycle is one recall, teaching, assessment, teach-back, and record for one Concept. A conversation can hold several. Each completed cycle gets its own log block, even when several share a date. An interrupted cycle stays `in_process` and gets no completed-cycle block.

After a completed cycle, rebuild the Book (section 8) and offer three choices in one line: continue this Chapter, choose another Chapter or Concept, or stop. Do not start the next Concept without the learner's choice.

## 6. Grade honestly

- Post the rubric and the expected answer with the grade, never before the question. The rubric fails an answer on a wrong step, not on a missing one.
- Hold a grade under pushback. Restate it once with the reason, record the disagreement, continue. Do not debate and do not agree with a wrong step.
- When the learner asks for the answer: give it with its process, mark a miss dated today, then ask a similar question.
- Self-report never sets `shaky` or `fluent`. "I know this" adds a note.
- The learner may drop a concept at any time, at graph approval or during any later session. Write `skipped` with no date and no passes, and put the reason in the note: `self-report, not needed` or `self-report, done`. Say one line: the record shows it as untested, and a later failure on a dependent concept turns it `shaky`.
- A deliberate "done" after a lecture is that same skip. An abandoned session is not: leave the row `in_process`.
- Teaching sets `in_process` and nothing else. A verdict replaces it, and the marker never counts as evidence.
- If the learner fails a concept that has a `fluent` prerequisite, the prerequisite was graded too generously. Set it to `shaky` and say why.
- A failed concept with a `skipped` prerequisite shows the skip was a guess. Set that prerequisite to `shaky` and say why.

## 7. Sources

- Synthesize the three tiers into one narrative. Do not present them as separate voices.
- When sources disagree in a way that changes the lesson, show the disagreement in one line and teach the stronger evidence.
- Name the source for load-bearing numbers, definitions, and causal claims. Do not cite every sentence.
- Never fill a gap silently. Say what is unknown.

## 8. File formats and book assembly

`graph.md`:

```md
# Topic: <topic>
Goal: <one line, optional>
Book: <title, optional>

## Chapters
1. <chapter title>: <scope>

| # | Concept | Definition | Prerequisites | Chapter | Section |
|---|---|---|---|---:|---:|
| 1 | <name> | <one line> | - | 1 | 1 |
| 2 | <name> | <one line> | 1 | 1 | 2 |
```

Omit `Book` when the topic is the title. Omit `## Chapters` for one chapter. Use that chapter's table value `Chapter = 1` and section numbers within it.

A dated Lecture and a Lecture draft share one file per concept and differ in frontmatter:

```md
---
date: 2026-10-28
concept: 3
---

# <concept name>
```

```md
---
status: draft
concept: 3
---

# <concept name>
```

A legacy `plan.md` stays on disk untouched. Nothing reads or writes it.

Assemble a book by grouping lecture files according to Chapter and Section metadata, in textbook order, including drafts and dated Lectures. Each lecture file remains one concept. The page labels a draft as a draft and never shows learner states.

Run `node skills/study-plus/scripts/build-book.mjs study/<slug>` from the workspace root after a complete or partial draft batch, after saving a Lecture, and after a graph rebuild. The learner does not need to ask. The builder copies the current `book.html` to `book.html.bak` before each replacement, and it replaces the older backup. If the builder fails, the current Book stays intact: say which path failed in one line and continue the Concept cycle. If it reports a malformed graph, explain the issue and propose a graph fix for confirmation before changing it.

`state.md`:

```md
| # | Concept | State | Last evidence | Passes | Misses | Note |
|---|---|---|---|---|---|---|
| 1 | <name> | new | - | 0 | 0 | |
```

The states are `new`, `shaky`, `fluent`, `skipped`, and `in_process`. A `skipped` row has no date, no passes, and a note that the learner dropped it. An `in_process` row has no date, and its note reads `taught, no verdict`.

`diagrams/` holds one SVG per figure, named for what it shows. The client renders it from a relative path, so write the file before the sentence that shows it. Inline SVG is escaped and appears as text.

`log.md`, one block per Concept cycle:

```md
## 2026-10-25
Concept: <name>
Result: <2 of 3 correct; teach-back incomplete>
Gap: <the specific thing that failed>
Next: <concept> because <reason>
```
