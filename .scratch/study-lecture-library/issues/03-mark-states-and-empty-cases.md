# 03 — Mark states, fold the archive, and name the empty cases

Status: ready-for-agent
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
