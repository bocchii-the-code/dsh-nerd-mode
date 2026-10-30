# 02 — Read and model the lecture library

Status: ready-for-agent
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
