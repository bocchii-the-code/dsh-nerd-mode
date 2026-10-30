# 03 — Mark states, fold the archive, and name the empty cases

Status: resolved
Blocked by: 02

## Question

Make the list tell a learner what each lecture is, and what the panel could not find.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Empty and failure states**, **Accessibility**, and **Refresh**.

1. Each entry shows its Concept number, its title, and one state: `Draft`, or the teaching date when the frontmatter carries one. An entry with no state shows neither mark.
2. Each topic's archived lectures sit inside a folded group opened by one button. The button reports its expanded state through `aria-expanded`. The main list holds no archived entry.
3. A topic with no lectures in it carries one muted line of its own.
4. A workspace with no `study/` folder shows one line that names the searched folder and the command that creates a Tracker.
5. A read failure shows one line that names the failure, and the page keeps every entry it already built.
6. Accessibility: the page is one region named `Lectures`. Entries are buttons inside a list. Focus stays visible. Enter or Space opens an entry. A screen reader announces number, title, and state.
7. The list stays one column. Titles wrap instead of truncating.
8. Read once on mount. Keep no refresh control.

## Tests

Extend `test/client.test.mjs` through the existing mount helper. Cases:

- a draft entry is marked as a draft and carries no date, and a dated entry carries its teaching date;
- archived files sit in the folded group and leave the main list;
- a workspace with no `study/` folder names the searched folder and the command;
- a topic with no lectures shows its own empty line;
- a read failure shows one line and keeps the entries already built;
- the page is a region named `Lectures`, and each entry is a button inside a list.

Do not assert on style values. Assert on roles, labels, and text.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- Every case in the spec's Cases to cover list that names a mark, a fold, or a message is asserted by a test.

## Validation owner

The implementer runs `npm test` and `npm run lint`.

## Answer

The model now separates a missing root from an empty one, each row carries one mark, and each topic folds its archive.

### Model

`listFolder` returns `{ entries, error, found }`. `found` is true only when the remote answers `ok`. A `workspace-file/not-found` answer is an empty listing with `found: false`. `loadLectures` returns `{ topics, error, rootFound }`, where `rootFound` is that flag for `study`.

### Marks

`lectureRow` renders one button per entry with the text `<NN> · <Title>` plus ` · <mark>` when the entry has a state. A draft shows `Draft`. A taught Lecture shows its date as `28 Oct 2026`, built from a month table so the text does not depend on the test machine locale. An entry with no state shows neither. An archived entry inside the fold shows no extra mark, because the group button already names the state. The model keeps the archived date for ticket 04 if it wants it.

### Archive fold

`lectureTopic` splits entries on `state === 'archived'`. The main list holds only the rest. When a topic has archived entries, one button follows the main list with the text `Archived lectures (<n>)`, `type="button"`, and `aria-expanded` driven by one `openTopics` object on the page. The fold starts closed. It renders the archived `ul` only when open, and the entries keep the model order, which is Concept number ascending.

### Empty and failure states

Order in the page body:

1. No root: `No Tracker in study/. Run /study-plus to create one.`, and no topic sections. This is the same line and command as the Study view.
2. Root exists: any model error renders one `role="alert"` line above the sections: `The lecture library could not be read: <message>.` Every entry already built stays.
3. A topic with no main-list entry renders one muted `No lectures yet.` line and no `ul`.

An empty `study/` folder therefore renders no topics, not the no-Tracker line. A topic that holds only archived entries shows the empty line and the fold.

### Accessibility and layout

The page stays one region named `Lectures`. A row is `li > button[type=button]`. The button text is the accessible name, so it carries the number, the title, and the state. Focus uses a `:focus-visible` outline from one small `<style>` block, drawn with `var(--dsw-alias-state-business-primary)` and offset by 2px. The row button is full width, wraps its text (`white-space: normal`, `overflow-wrap: anywhere`, no fixed height), and aligns left, so the list stays one column.

### Tests

`node --test`: 83 passing, 79 before. `npx eslint .`: clean. The lecture helpers now read the main list from the section's first `ul` and the archive list from the second, so an opened fold cannot leak into the main-row assertions. New tests cover draft and date marks, the closed and open fold, the no-root line, the empty root, the per-topic empty line, the failure line above the list, and the region and list roles.

### What ticket 04 must know

A row is exactly:

```js
React.createElement('li', { key: entry.number },
  React.createElement('button', {
    type: 'button',
    className: 'lectures-entry',
    style: lectureRowStyle,
  }, `${entry.number} · ${entry.title}${mark === null ? '' : ` · ${mark}`}`))
```

Ticket 04 adds `onClick` to that button. It needs no wrapper, no id, and no restructure. The row button is the only handler-free control on the page today, and the archived rows use the same `lectureRow` builder, so one change covers both lists. The page body gets only `sessionId` and `workspaceFiles`, as before. The archived date stays in the model at `entry.date` for a future mark.
