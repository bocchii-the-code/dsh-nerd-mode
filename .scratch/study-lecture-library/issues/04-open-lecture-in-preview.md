# 04 — Open the lecture in the dock preview

Status: ready-for-agent
Blocked by: 03

## Question

Picking an entry must open that file in the dock's document preview, so the lecture renders with headings, formulas, and figures.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Reading** and **Out of Scope**.

1. Build the address with the session file address helper the preview package itself uses, imported from its package row. Do not assemble the address by string concatenation. The shape it produces is `dsh-resource://file/session/<sessionId>/<encoded path relative to the workspace root>`.
2. Open it through the dock's own action on the tab, so the file lands in the dock. Ask for a second pane so the list stays visible beside the lecture. Do not call the controller from outside the tab.
3. The panel renders no Markdown itself. No `document.createElement`, no HTML string, no inner HTML.
4. Confirm the required package row is declared before relying on the require. If a row must be added to `dsh.client.inject`, add exactly one and say so in the Answer.
5. Keyboard activation opens the same way as a pointer press.

## Tests

Extend `test/client.test.mjs` through the existing mount helper. Assert:

- picking an entry opens the document preview with the session file address of that lecture;
- the address names the right session, the right topic, and the right file;
- reopening the panel requests one tab, not two.

Do not assert on style values.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- No string-built resource address appears in `client.js`.

## Validation owner

The implementer runs `npm test` and `npm run lint`. The merger checks that the address in the test is the helper's output, not a hand-written literal copied from the implementation.
