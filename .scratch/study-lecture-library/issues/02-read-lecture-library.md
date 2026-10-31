# 02 — Read and model the lecture library

Status: resolved
Blocked by: 01

## Question

Turn the workspace folder into one list of topics and lecture entries, and draw the plain list. No marks, no dates, no messages yet.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Data scope**, **Reads**, **Entry shape**, and **Ordering**.

1. Resolve the session from the source that ticket 01 recorded in its Answer. Every read names that session.
2. List `study/`. Keep directories as topics. A missing `study/` folder is an empty result, not a failure.
3. For each topic, list `study/<topic>/lectures/` and `study/<topic>/lectures/archive/`. A missing `lectures/` folder is an empty result. Leave `book.html`, `graph.md`, `state.md`, `log.md`, and `diagrams/` out of the list.
4. Read each lecture file once and parse only its leading frontmatter block. The two frontmatter shapes are:
   - draft: `status: draft` plus `concept: <n>`, no date;
   - taught: `date: <YYYY-MM-DD>` plus `concept: <n>`, no `status`.
5. Build one entry per file: Concept number from the filename prefix (the `NN` in `<NN>-<slug>.md`), topic slug, title from the first level-one heading, the frontmatter `concept` value when present, and one state: `draft`, `taught` with its date, `archived`, or none.
6. A file whose frontmatter will not parse keeps its number and title and shows no state. Do not drop it.
7. A title with no heading falls back to the filename slug.
8. Sort topics by name. Sort lectures by Concept number, ascending, inside each topic. Archived lectures sort inside their own group. A lecture never appears twice.
9. Any read error other than a missing folder becomes model data, not a thrown error. The entries already built stay in the model.

Draw the body as one column: one topic heading per topic, one row per lecture, each row showing the Concept number and the title. Ticket 03 adds the marks, the dates, the archive fold, and the messages.

Keep the code inside `client.js`. The client loader resolves only platform modules and declared package rows, so a relative require throws and the bundle cannot carry export statements.

## Tests

Extend `test/client.test.mjs` through the existing mount helper and the fake file remote keyed by path. Cases:

- two topics are listed in name order, and their lectures in Concept number order;
- a workspace with no `study/` folder is an empty result, not an error;
- a topic with no `lectures/` folder is an empty result;
- a lecture with broken frontmatter keeps its number and title;
- `book.html` and the three tracker files never appear;
- a read failure leaves the entries already built in the model.

Do not assert on style values.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- The panel issues no read outside `study/<topic>/lectures/` and `study/<topic>/lectures/archive/`.

## Validation owner

The implementer runs `npm test` and `npm run lint`.

## Answer

The body now owns the list. It registers with `inject: (sessionId) => ({ sessionId, workspaceFiles: ctx.remote.workspaceFiles })`, as ticket 01 recorded. `useTabInfo` and the working directory stay unwired because no read needs `cwd`.

### Model

`loadLectures` returns `{ topics: [{ topic, entries }], error }`. Each entry is `{ number, topic, title, concept, state, date }`:

- `number` is the `NN` string from `<NN>-<slug>.md`; the display keeps it as written, and the sort uses `Number(number)`. A name with fewer than two digits is not a lecture.
- `concept` is the parsed frontmatter number or `null`.
- `state` is `'draft'`, `'taught'`, `'archived'`, or `null`.
- `date` is the frontmatter `YYYY-MM-DD` string or `null`.
- `title` is the first `#` heading, else the filename slug.

A broken frontmatter block is one with no closing fence or a non-blank line that is not `key: value`. Such a file keeps its number and title and gets `state: null`, `concept: null`, and `date: null`. It stays in the list.

### Reads

In order: `study`, then per topic `study/<topic>/lectures` and `study/<topic>/lectures/archive`, then one `read` per matching `NN-*.md` file. A `workspace-file/not-found` on any folder is an empty listing. Every other list or read failure sets `model.error` and leaves the entries already built. A failed file read drops that file from the list. `book.html`, `graph.md`, `log.md`, `state.md`, and `diagrams/` are never listed or read: the panel never lists the topic folder itself.

A duplicate number in the main folder and the archive folder resolves to the main file, so a lecture never appears twice.

### Rendering

One `section` per topic, in name order, holding an `h2` with the topic name and one `li` per lecture with the text `<number> · <title>`. Archived entries currently sit in the same list because the fold belongs to ticket 03. The region keeps `role: 'region'`, `aria-label: 'Lectures'`, and `panelStyle`. No style constant is new: `panelSectionStyle`, `panelHeadingStyle`, `panelListStyle`, and `panelMutedStyle` cover every node.

### Tests

Seven tests added, one placeholder test replaced. `node --test`: 79 passing. `npx eslint .`: clean.

### What ticket 03 must know

1. Render `content.error` yourself. It is model data today and no line shows it.
2. Archived entries are already read and modelled, and they currently render mixed into the main list. The fold must split them by `state === 'archived'`.
3. The model does not record whether `study/` was missing. A missing root and an empty root both give `topics: []`. Add the flag in ticket 03 or the "no Tracker" message cannot tell them apart.
4. A topic with no `lectures/` folder gives a group with `entries: []`, the same as an empty folder. Use `entries.length === 0` for the per-topic line.
5. A row is plain `li` text `NN · Title`. The preview open and the keyboard story need a button inside it.
6. `state` and `date` are already in the model. Do not re-read the files for the mark and the date.
7. The body still gets only `sessionId` and `workspaceFiles`. The preview open needs `useTabInfo`, which ticket 04 owns.
