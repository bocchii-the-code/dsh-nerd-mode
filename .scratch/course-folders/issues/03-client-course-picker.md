# 03 — Course picker in both tabs

Status: ready-for-agent
Blocked by: 01

## Question

Make the panel show one Course at a time, with one shared selection across the Study tab and the Lectures tab.

## Scope

Read the spec at `.scratch/course-folders/spec.md`, sections **Panel**, **Graph heading**, and **Vocabulary**.

Edit only `client.js` and `test/client.test.mjs`.

1. `TRACKER_ROOT` stays `'study'`. Add one module-level `let activeCourse = null` beside it. The bundle is a classic script, so a module-level binding is the whole mechanism.
2. The Study tab's existing picker becomes the Course picker: label it Course, set its `aria-label` to Course, and keep its current rule that it appears only when there are two or more Courses. Setting it writes `activeCourse`.
3. The Lectures tab gains the same picker, above its list, with the same rule and the same selection. It lists the selected Course's lectures only, grouped as today.
4. The initial selection is `activeCourse` when it names a Course that still exists, otherwise the only Course, otherwise the first by name.
5. Empty states say Course and keep the existing structure: no `study/` names the folder and `/study-plus`, and a Course with no lectures keeps its per-group line.
6. The graph reader accepts `# Course: <name>` and `# Topic: <name>`. A missing title line falls back to the folder slug as today.
7. Rename user-facing strings only. Internal names (`loadTopic`, `discoverTopics`, `topicPicker`, `snapshot.topic`) stay.
8. Update the pinned assertions: the picker label, the view id and label, the conversation-view registration, the empty-state text, the `study/` list call, and the fixtures that carry `# Topic:` or a single folder.

## Tests

- `node --test test/client.test.mjs` passes.
- New assertions:
  - a `study/` with two Course folders renders a Course picker and lists the first Course only;
  - switching the picker in the Study tab changes the Lectures tab, and the two tabs read the same selection;
  - the lectures of the second Course are not listed until it is selected;
  - a graph with `# Course: Ratios` shows the title `Ratios`, and one with `# Topic: Ratios` also shows `Ratios`;
  - a Course with no lectures keeps its empty line and issues no read outside that Course folder.

## Acceptance

- Both tabs show the same Course.
- A workspace with one Course shows no picker and behaves as today.
- No read leaves the selected Course folder.
