# 04 — Open the lecture in the dock preview

Status: resolved
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

## Answer

Picking a row opens that lecture in the dock's document preview through the tab's own action.

### Address builder

`client.js` now carries `FILE_ADDRESS_PREFIX`, `encodeSegment`, `encodePath`, and `sessionFileAddress`, copied verbatim from `@deepseek-ai/dsh-util-workspace-path`. The comment above them names that source. They sit above `lectureRow`, and every address comes from `sessionFileAddress(sessionId, entry.path)`. `client.js` holds no other `dsh-resource://` string.

`loadLectures` now keeps `path` on each entry, the workspace-relative path it was read from (`study/<topic>/lectures[/archive]/<file>.md`). The click needs no second lookup, and the folder is still read once.

### Click

`LecturesPage({ useTabInfo, sessionId, workspaceFiles })` takes `const { tab } = useTabInfo()` and builds one closure:

```js
const open = (entry) => tab.actions.openResource(
  sessionFileAddress(sessionId, entry.path),
  { preferNewPane: true },
);
```

`lectureTopic(group, open, onToggle, onOpen)` passes it to `lectureRow(entry, onOpen)`, which attaches `onClick: () => onOpen(entry)` to the existing `button`. The archived list uses the same builder, so both lists open the same way, and an archived address keeps its `archive/` segment.

The handler calls the tab action, not the controller. The address is the same session file address the preview package builds, so no string concatenation remains.

### Keyboard and rendering

The row stays `li > button[type=button]`, so Enter and Space activate it through the platform. No key handler was added.

The panel still renders no Markdown: no `document.createElement`, no HTML string, no `dangerouslySetInnerHTML`, no inner HTML.

### One tab, not two

Reopening dedupe is host behaviour. The plugin controls the registration shape, and that shape is unchanged: `LECTURES_DEFINITION` names no `multiple` field and no `patterns`. The existing test asserts both fields are `undefined` on the registration, so the host keeps one fixed page address and focuses that tab. The test does not fake the registry's dedupe.

### Tests

`node --test`: 86 passing, 83 before. `npx eslint .`: clean.

`renderLectures` now injects a fake `useTabInfo` whose `openResource` pushes `[address, options]` into an exposed `opened` array. New tests:

1. Clicking `02-groups.md` opens `dsh-resource://file/session/session-1/study/algebra/lectures/02-groups.md` with `{ preferNewPane: true }`.
2. After the fold opens, clicking `04-old-sets.md` opens `dsh-resource://file/session/session-1/study/algebra/lectures/archive/04-old-sets.md` with the same option.
3. A file named `05-a b.md` opens `dsh-resource://file/session/session-1/study/algebra/lectures/05-a%20b.md`. The test first pins `encodeURIComponent('05-a b.md')` to `05-a%20b.md`, then pins the full address literal, so a drifting encoder fails.

Every address assertion pins the full literal string, so a changed prefix, session id, topic, folder, or encoder fails a test.

