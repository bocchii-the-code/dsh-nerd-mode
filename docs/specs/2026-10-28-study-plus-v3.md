# Study, Study Plus, and Nerd Mode, v3

Two skills and one switch. `/study` guides one concept or one task and grades nothing. `/study-plus` organizes a topic as a Book of Chapters and Sections, runs one Concept cycle at a time, writes a draft per Concept, and saves one file per concept. The switch makes teaching the default posture of any conversation, in any mode.

Terms are defined in [GLOSSARY.md](../../GLOSSARY.md). Decisions live in `docs/adr/`.

Status: v3 settled 2026-10-28, replacing v2 as the current behavior. The [v2 spec](2026-10-27-study-plus-v2.md) stays as the historical record. See ADR 0010 for the Book, Chapter, and Section model.

Amended 2026-10-28 by the [lecture drafts and free exploration spec](2026-10-28-study-drafts-and-free-exploration.md): lecture drafts, free Chapter and Concept selection, no active target, and automatic Book rebuilds with a backup. See [ADR 0011](../adr/0011-drafts-and-free-selection.md).

Amended 2026-10-28 by the [session defaults spec](2026-10-28-nerd-mode-settings.md) and [ADR 0013](../adr/0013-session-defaults-for-recall-and-questions.md): profile defaults in DSH Settings for the Recall Session, unfixed unseen-question count and form, and the count-driven pass bar. The Recall Session is the learner-answer form and not the old tutor recap.

## Non-goals

No spaced-repetition scheduler, no decay timer, no multi-learner. The lesson stays text plus SVG figures. A converted document and a one-page HTML explainer may support it, but neither replaces the lesson.

The book page is a reading view. It is not a second source of truth and never feeds state back into the learner model.

The switch edits text only. It never changes the tool set, so the request tool catalog and the prompt cache stay stable.

## Switch

The Nerd Mode switch keeps its v2 shape: one profile-level plugin, one session projection keyed `studyMode`, one prompt section named `study:policy`, and the `/nerd-mode on|off` command. The upper DSH instruction owns all routing. It sends an explicit `/study-plus` directly to tracked study with no route question. It sends an explicit `/study` or a default learning-shaped request to `study`, and asks the one route question when multiple independent concepts appear. The skills do not carry a second copy of that prompt. See ADR 0008 and ADR 0009.

## Responsibilities

| Area | `/study` | `/study-plus` |
|---|---|---|
| Teaching | One concept or one task | One concept per session |
| Grading | None | Per concept |
| Tracker | None | Chapter graph, state, log |
| Saved files | A requested lecture or artifact | Automatic lecture save per tracked session, plus `book.html` after each batch and session |
| Figures | When a picture helps | When a picture helps |
| Book | One-off book-style answer in chat | Chapter graph in the topic, optional HTML page |

`study` is the only place where lecture-writing rules live. `study-plus` loads it before Teach and follows the same standard. This keeps one rule set for the direct lesson and the recorded lecture.

`study-plus` owns the learner model and the automatic lecture save for each tracked session. It reads and writes the chapter graph, the state, the log, and the tracked lecture files. It coordinates draft generation and rebuilds `book.html`. For a direct request, `study` may save or update a requested lecture file or other ordinary file at a path the learner names, including a path under `study/<slug>/lectures/`. It must not read or update `graph.md`, `state.md`, or `log.md`. A legacy `plan.md` is inert user data, and nothing reads or writes it.

`study` never loads `study-plus`. When the learner wants a record, the request moves to `/study-plus` by the learner's choice.

The upper DSH instruction owns all routing. It decides between `study` and `study-plus` before either skill starts. The skills do not carry a second route prompt.

## Multi-concept routing

An explicit `/study-plus` request goes straight to tracked study. It bypasses the route question even when it names multiple independent concepts. The upper DSH instruction loads `study-plus` with the current topic and material.

An explicit `/study` request or a default Nerd Mode request that names two or more independent concepts gets one route question: a one-off book-style answer in chat, or a tracked `/study-plus` session. The upper DSH instruction asks with the question tool. Do not guess from the length of the request.

- If the learner chooses the tracked session, load `study-plus` and carry the current topic and material into it.
- If the learner chooses the one-off answer, write plain Markdown. H1 is the Book or title, H2 is a Chapter, H3 is a Section. Use no code fences.
- The one-off answer grades nothing. The optional practice offer stays.
- A single concept uses the concept as H1. It does not grow chapters it does not need.
- If the whole answer fits in one response, send it whole. If not, mark what is covered and what is not, then wait.

`study` never loads `study-plus` on its own. The upper DSH instruction is the only route between the two skills.

## Organization

The domain hierarchy is Book, then Chapter, then Section. Each concept maps to exactly one Section named after the concept. A Chapter groups related Sections using the source's chapter structure when one is provided. Without a textbook outline, `study-plus` proposes groupings from conceptual and teaching relationships.

Section order inside a Chapter is reading order, taken from the source when one is provided. One Section holds one concept. `study-plus` still teaches and assesses one concept at a time. Learner state stays per concept.

Book order and learning order are independent. The concept table stays in prerequisite order. A Chapter is not a prerequisite unit, and a concept can be taught before an earlier Chapter when the learner chooses it.

## Selection

The learner chooses any Chapter or any Concept. The learning order supports a recommendation and never restricts the choice. A prerequisite may be explained, and one Recommended concept may be named, but neither redirects nor blocks the selection.

A Chapter selection continues in Book order. It resumes an `in_process` Concept in that Chapter, and the learner chooses when more than one exists. Otherwise it takes the earliest Concept in that Chapter that is neither `fluent` nor `skipped`. When the Chapter has none, it offers a review or another choice and starts nothing.

Selecting a `skipped` Concept restarts it, and its row changes to `in_process` only when teaching starts. Selecting a `fluent` Concept is allowed for review.

There is no persistent target and no prerequisite path. A legacy `plan.md` stays on disk and is ignored.

## Chapter graph

`graph.md` keeps `Topic` and `Goal`. It gains an optional `Book` line and, for more than one Chapter, a `## Chapters` list in reading order. Each line in that list is `1. <title>: <scope>`.

The concept table stays in prerequisite-learning order and gains integer `Chapter` and `Section` columns. Section numbers start at 1 within each Chapter. One concept occupies one Section.

```md
# Topic: Shampoo and Adam optimizers
Book: Shampoo, before and after Adam
Goal: Read the paper without hand-waving the preconditioner.

## Chapters

1. Optimization refresher: the update rules and their assumptions
2. The Shampoo preconditioner: construction and cost
3. Experiments and limits: what the paper measures

| # | Concept | Definition | Prerequisites | Chapter | Section |
|---|---|---|---|---|---|
| 1 | stochastic gradient descent | ... | - | 1 | 1 |
| 2 | per-coordinate scaling in Adam | ... | 1 | 1 | 2 |
| 3 | the Shampoo preconditioner | ... | 2 | 2 | 1 |
| 4 | wall-clock gains and their limits | ... | 3 | 3 | 1 |
```

When `Book` is absent, the topic is the book title. A single-chapter graph omits `## Chapters`, but every row still carries Chapter 1 and its Section order. For that single Chapter, the display title falls back to the Book title, then to the topic.

A new graph and its chapter group list appear together in the existing approve, edit, or rebuild question. The graph changes only on request or at first approval. A wrong grouping mis-teaches for weeks, so the approval is a real gate.

## Lectures

A tracked lecture file holds one concept. It lives at `study/<slug>/lectures/<NN>-<slug>.md`, where `NN` is the concept number in learning order and `<slug>` is the concept slug. The body opens with an H1 named after the concept.

One path holds two content states. A Lecture draft carries `status: draft` and the concept number, and no teaching date. A dated Lecture carries `date` and the concept number, and no `status`. A file with both a date and `status: draft`, or with an unknown `status` value, is malformed, and the builder refuses it.

`study-plus` writes one draft per concept after graph approval and the skip choice, including skipped concepts. `/study` writes the content at the destinations it receives, and `study-plus` checks the result. Skipped and non-overlapping Chapters may go to subagents in parallel. A partial batch keeps the drafts it finished, reports the missing ones, and lets the learner continue.

`study-plus` saves the full lecture before it displays any of it. If a platform limit forces chunks, it assesses only after every section has been shown. A missing draft for the selected concept is written before teaching starts.

During a Concept cycle the draft is revised for the learner and the current material, then saved as the dated Lecture in the same file. On a retake, `study-plus` updates the same file. It reads the existing file first and checks for manual changes. When a safe merge is not possible, it asks before writing.

A valid existing draft or dated Lecture is never replaced by a draft batch. An occupied or unrecognized target is reported and left alone.

If saving the lecture fails, teaching and assessment continue. The session reports the path that failed.

Figures live under `study/<slug>/diagrams/`. A direct `/study` figure defaults to `diagrams/<topic>/` in the workspace. Overwriting a same-name SVG keeps one `.bak` copy of the previous file. A later overwrite replaces that backup.

`study` defaults to chat. It saves a lecture or other requested artifact only at a path the learner names, including a path under `study/<slug>/lectures/`. A figure follows the default path above.

## Legacy migration

An older graph is never rewritten silently. Show a preview and ask whether to retain the current organization or adjust it. The old `## Structure` list and `Block` column become `## Chapters` and a `Chapter` column. A graph with no grouping gets a proposed chapter list based on its concepts.

On confirmation, write the new graph once, keeping the Topic, Goal, and any Book title. Preserve every tracker state and every lecture body. A concept that keeps an exact unique name may have its lecture file renamed and its frontmatter updated when renumbering moves it. When the same name appears more than once, ask which file belongs to which Section. A changed concept name keeps its state and material only when the learner confirms an explicit mapping from the old name to the new name. A changed definition or changed prerequisite lists the affected drafts and asks whether to keep or rewrite each one. A removed concept has its file moved to `lectures/archive/`, never deleted.

The book builder keeps accepting the old schema during migration, so an unmigrated topic can still be read.

## Book builder

Book generation is automatic. `study-plus` invokes the repository builder after a complete or partial draft batch, after a saved Lecture, and after a graph rebuild. The builder renders through the existing `am.mjs` dependency. No package change is needed.

Each rebuild copies the current `study/<slug>/book.html` to `book.html.bak` before it replaces the page, and it replaces the older backup. A failed build leaves the current page and its backup untouched, and it does not block the Concept cycle.

The page includes drafts and dated Lectures and labels draft content as draft. It never shows learner states. The page uses the Section ordinal from the graph, so a Section keeps its original textbook number even when an earlier lecture is missing. The Chapter title shows the count of included Sections, which are the Sections with an existing file. The rendered page may therefore show a gap in Section numbers while its count still says how many Sections are included. One Section is one page, and the page supports full text search.

- A graph Section with no file is omitted.
- A Chapter with no remaining Sections is omitted.
- `lectures/archive/` is never included. A retired Concept's file lives there.
- An orphan lecture file stays on disk, is excluded from the book, and is reported.
- Two lecture files that map to the same concept stop the builder.
- An invalid Chapter or Section mapping stops the builder. This includes a non-integer value, a duplicate slot, a gap in the graph's Chapter or Section numbering, a Chapter not listed, or a Section outside its Chapter.
- Malformed lecture frontmatter stops the builder. This includes a draft that carries a date, an unknown `status` value, and a dated Lecture with no date.
- A topic with no lecture files fails with a clear message. If every lecture is an orphan, it also fails.

The builder never repairs the graph. It reports the problem, and the agent proposes a repair. Ask before editing the graph.

## Writing standard

The learner's material determines the scope, the Book title, and the Chapter names and order. It is reference, not fact authority. Accuracy wins. Read the material, verify important or uncertain claims when needed, and state a discrepancy in one line.

Use the approved graph and the learner's material by default. Do not run an external lookup for every lecture. A long source gets a roadmap and a progress marker before teaching starts.

A lecture carries the main ideas, their relationships, and the qualifications that limit them. It moves from intuition to terms to formal detail. It uses concrete examples and analogies, and states where an analogy stops matching. Headings follow the content, and a fixed five-beat template is not required. Exam focus appears only when it is relevant.

Math uses LaTeX. Define every symbol and its role. Justify every nontrivial derivation step and interpret each equation in plain words. Check algebra, arithmetic, assumptions, and units before sending.

`study` ends with an optional practice offer and no understanding check. For a task, it produces the requested artifact and does not force the work into a chapter.

## Session spine

`study-plus` keeps the five-step spine: Recall Session, teach, unseen questions, teach-back, and record. It loads `study` before Teach. The lecture is saved before display, and assessment starts only after all lecture sections are shown. Each verdict updates one concept. One completed Concept cycle writes one log block, and a conversation can hold several cycles.

The Recall Session and the unseen-question group follow this profile's saved defaults in DSH Settings (`recallSessionEnabled`, `unseenQuestionCount`, `unseenQuestionType`), not shipped constants. The pass bar follows the count: `ceil(2 × count / 3)` correct slots plus a passed Teach-back for count ≥ 1, and a passed Teach-back alone at count 0. An explicit preference inside one `/study-plus` request overrides its default for that session and does not update the profile. See [ADR 0013](../adr/0013-session-defaults-for-recall-and-questions.md).

After a completed cycle the learner chooses: continue the Chapter, choose another Chapter or Concept, or stop. The next cycle does not start on its own. An interrupted cycle stays `in_process` and gets no completed-cycle block.

`study` has no such spine. It teaches in steps, stops at the fork, and ends with the practice offer. It writes no learner state and grades nothing.

`state.md` and `log.md` keep their existing formats and rules. State remains one row per concept, and the log appends one block per completed Concept cycle. There is no plan file in the active model.

## Tests

`test/book.test.mjs` covers both graph schemas, a single Chapter, multiple Chapters, and a missing `Book` line. It covers the parsed units and Chapter counts that drive one page per Section, including a kept Section ordinal when an earlier lecture is missing, omission of missing lectures and empty Chapters, orphan reporting, duplicate concept files, and an invalid Chapter or Section mapping. It also covers draft and dated-Lecture parsing, the draft label in the page payload, a draft that carries a date, an unknown `status` value, exclusion of `lectures/archive/`, backup replacement on a second build, and a failed build that leaves the current page and backup intact.

`test/settings.test.mjs` covers the plugin `Config` schema (required non-empty `section`, volatile defaults, count bounds 0–10 and endpoints, the three question types), the `study:policy` section text (base-only without a completed `study-plus` turn, defaults block appended for a direct or skill-loaded `study-plus` turn, untouched for `/study` or a failed load), and the skill text rules in [ADR 0013](../adr/0013-session-defaults-for-recall-and-questions.md).

Manual checks cover the migration preview, preservation of state and lecture bodies, an exact-name remap, an ambiguous name that must ask, removed-Concept archiving, the routing question on explicit `/study` and default entry, the explicit `/study-plus` bypass, both answers to the question, a Chapter selection in Book order, an explicitly selected skipped Concept, a `study` save path that includes a lecture under the topic, the draft handoff and its per-Chapter split, a partial draft batch, the study-plus load of `study` before Teach, save-before-display, assessment after the last section, and the automatic rebuild points. `test/fold.test.mjs` and `test/client.test.mjs` stay in place.

## Open risks

- **A proposed grouping can be wrong.** Without a textbook outline, Chapters come from the model's judgment. The approval gate is the only check.
- **Two orders can be confused.** Book order serves rereading. Learning order serves prerequisites. The table and the book page must label which order they show.
- **A migration can rename the wrong file.** An exact unique name is safe to remap. A repeated name asks, but a wrong unique match remains possible.
- **Archive folders accumulate.** A retired Concept keeps its file under `lectures/archive/` and the page never shows it. A learner who ignores the report keeps stale files on disk.
- **A saved lecture can drift from the graph.** Manual edits stay in the file, and a retake asks only when a merge is unsafe. A stale lecture can still appear in a rebuilt book.
- **A draft can lag the graph.** A changed definition or prerequisite leaves the old draft in place until the learner decides. Graph approval names the affected drafts, but a learner can keep a stale one.
- **A failed rebuild leaves the previous page.** The page still looks current after a draft batch or lesson that the builder could not render. The failure is reported, and the page is not marked stale.
- **A one-off book-style answer can be long.** Chunking leaves the learner waiting between parts. The covered and uncovered markers are the only progress signal.
