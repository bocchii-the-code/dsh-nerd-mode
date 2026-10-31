# 01 — Course vocabulary and selection in study-plus

Status: resolved

## Question

Call the record a Course in `study-plus`, settle which Course a conversation uses, and teach the graph reader the new heading.

## Scope

Read the spec at `.scratch/course-folders/spec.md`, sections **Course names**, **Selection**, **Second subject**, **Command argument**, **Graph heading**, and **Book build**.

Edit only `skills/study-plus/SKILL.md`, `cordis.patch.yml`, `skills/study-plus/scripts/book-data.mjs`, `skills/study-plus/scripts/build-book.mjs`, and `test/book.test.mjs`.

1. In the skill, replace every use of "topic" that names the record with Course. That covers section 1 (find the workspace), the calibration sentences, the graph section, the lecture section, the figures sentence, and the log wording. Keep the word only where it is an ordinary English word.
2. The record path stays `study/<course>/`. Keep `glob study/**`, the legacy `plan.md` rule, and the "a folder without `graph.md` belongs to something else" rule.
3. Selection, in this order:
   - no Course: ask for a name;
   - exactly one Course: use it, name it in one line, ask nothing;
   - several: ask one question that lists them and offers a new Course.
   Ask once per conversation and never again.
4. A new Course name comes from the learner's words. Slug it as the record slug is slugged today, show the slug in the confirmation line, and create the folder on first write.
5. Second subject: when a Course is already settled and the request is about a different subject, ask one question with two options, add these concepts to the current Course or start a new Course. The first option runs the existing graph change. Never ask two questions in one turn.
6. `argument-hint` shows a Course slug. `/study-plus <course>` settles the Course with no question. A named Course that does not exist gets one confirmation before creation.
7. Graph heading: new files open with `# Course: <name>`. Update the graph format block in the skill to say Course. Never rewrite an existing `# Topic:` heading.
8. `book-data.mjs`: accept `# Course:` and `# Topic:` as the title line, keep the folder-slug fallback, and keep the default when neither is present. Change nothing about chapter, section, or concept parsing.
9. `build-book.mjs`: user-facing messages say Course folder, not topic folder. Keep the one-level rule, the symlink guard, the containment check, and every internal name.
10. `cordis.patch.yml`: replace the topic wording with Course in the routing text, and add the Course step that the skill performs after an explicit `/study-plus`. Keep the four tracker files study-plus-only, keep the one-way dependency on `study`, and keep the opening-question rule.

## Tests

- `node --test test/book.test.mjs` passes.
- New assertion: a graph that opens with `# Course: Ratios` produces the title `Ratios`; one that opens with `# Topic: Ratios` produces the same title.
- `node --test test/prompt-consistency.test.mjs` passes.
- `git grep -n 'study/<topic>' skills/study-plus cordis.patch.yml` returns nothing.

## Acceptance

- A reader of `cordis.patch.yml` can state when the Course question is asked and when it is skipped.
- No skill sentence calls the record a topic.
- An old `graph.md` with `# Topic:` keeps its title in the Book.

## Answer

Resolved on `feat/course-folders`, commit 9013582, merged at aee7912.

`skills/study-plus/SKILL.md` now calls the record a Course everywhere it means the folder, and holds the selection rules: no Course asks for a name, one Course is used and named in one line, several get one question that lists them and offers a new Course. It settles once per conversation, carries the Course in the opening question's path item, and asks one two-option question for a second subject. `argument-hint` shows `<course-slug>`, `/study-plus <course>` settles the Course, and a missing folder gets one creation confirmation. New graphs open with `# Course: <name>`, a reader still accepts `# Topic:`, and no existing heading is rewritten.

`cordis.patch.yml` routes with the Course word and gains the Course settlement paragraph. `book-data.mjs` accepts either heading and keeps the folder-slug fallback. `build-book.mjs` changes only its messages.

Two phrases keep the old word on purpose: `learn the topic from zero` and `bare topic`. `test/prompt-consistency.test.mjs` pins both, and in each the word names the subject matter, not the record folder.

Verified: `node --test test/book.test.mjs` 21 pass, `node --test test/prompt-consistency.test.mjs` 6 pass, `git grep 'study/<topic>'` returns nothing.
