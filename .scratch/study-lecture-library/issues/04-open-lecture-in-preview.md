# 04 — Open the lecture in the dock preview

Status: ready-for-agent
Blocked by: 03

## Question

Picking an entry must open that file in the dock's document preview, so the lecture renders with headings, formulas, and figures.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Reading** and **Out of Scope**.

1. Build the address with the same builder the preview package uses: `fileAddressFor(sessionId, cwd, path)` from `@deepseek-ai/dsh-util-workspace-path`. It produces `dsh-resource://file/session/<encoded session id>/<encoded path>`, making the path relative to `cwd` when it sits inside it.
2. That package is a plain library with no service. The shipped viewer had its function inlined by a bundler, so a plain client plugin cannot load it from the browser module table. Carry the builder as a local function copied verbatim, name its source in a comment, and pin its output in a test. Do not hand-roll a different address shape.
3. Open it through the dock's own action on the tab, so the file lands in the dock: `tab.actions.openResource(address, { preferNewPane: true })`. The preference asks for a split and falls back to the target pane, which keeps the list visible beside the lecture. Do not call the controller from outside the tab.
4. The panel renders no Markdown itself. No `document.createElement`, no HTML string, no inner HTML.
5. `dsh.client.inject` gains no row. The module's own `inject` array already carries the dock services from ticket 01.
6. Keyboard activation opens the same way as a pointer press.

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

The implementer runs `npm test` and `npm run lint`. The merger checks that the address assertion pins the full literal form `dsh-resource://file/session/<id>/<path>`, so a drifting encoder fails a test rather than silently opening the wrong file.
