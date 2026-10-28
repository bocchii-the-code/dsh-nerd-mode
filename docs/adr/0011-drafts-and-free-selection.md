# Prepare drafts ahead of teaching, and let the learner pick

Status: accepted, 2026-10-28. Supersedes [ADR 0006](0006-target-path.md).

A learner waited between Concepts while each lecture was prepared. The persistent target and its prerequisite path also fought the way people read a Book: a learner who wanted Chapter 6 first had to argue with the tracker or walk every earlier Concept. v3 fixed grouping and numbering, but it kept both frictions.

Preparation now runs before teaching. After the graph is approved and the skip choice is recorded, `/study` writes one complete draft per Concept at that Concept's final lecture path, skipped Concepts included. A draft carries `status: draft` and the Concept number, and no teaching date. It holds the teaching explanation and examples, never the assessment set or its criteria. When the Concept cycle starts, the same file is revised for the learner and the current material, receives the teaching date, and loses the draft status. A draft is not evidence and never touches `state.md` or `log.md`.

Selection is free. The learner names any Chapter or any Concept. A Chapter continues in Book order, one Concept cycle at a time, and resumes an `in_process` Concept when one exists. A prerequisite may be explained and the lowest ready Concept may be recommended, but neither redirects nor blocks a choice. Selecting a `skipped` Concept restarts it only when teaching starts, and a `fluent` Concept may be reviewed. The target file and its path rule leave the active model. An existing `plan.md` stays on disk as inert user data, because deleting it would destroy a learner's notes to save a code branch.

The Book becomes a live view. It rebuilds after a complete or partial draft batch, after a saved Lecture, and after a graph rebuild, and it labels draft content as draft. Each rebuild copies the current `book.html` to `book.html.bak` first. A failed build leaves the current page untouched and does not block the Concept cycle.

Per-session preparation was rejected because it recreates the wait. Treating drafts as teaching records was rejected because preparation would then look like learning. Keeping the target as an optional hint layer was rejected because two selection rules in one flow produce two answers to "what next". Rebuilding the page only on request was rejected because a stale page after a graph or draft change looks current while being wrong.

Consequences. Drafts cost tokens and disk before the learner asks for them, and a changed definition or prerequisite can leave a stale draft, so graph approval lists the affected drafts and asks whether to keep or rewrite them. A draft may anchor the lesson on yesterday's material, which is why the cycle revises it before teaching. A removed Concept keeps its file under `lectures/archive/` and stays out of the page. The builder must now accept two frontmatter shapes and refuse a draft that carries a date.
