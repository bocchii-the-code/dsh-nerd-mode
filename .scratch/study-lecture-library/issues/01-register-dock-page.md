# 01 — Register the Lectures dock page

Status: resolved
Blocked by: none

## Question

Ship the seat for the panel: one dock tab type of kind `lectures`, one guide entry that puts its card on the Start page, and one page body registered in the keyed dock pane slot under the same id. Prove the seat works in the installed host before any list code exists.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Seat**, **Manifest**, and Further Notes paragraph 1.

1. Verify the host surfaces named in Further Notes against the installed host, not against memory. The notes from recon are at `.scratch/study-lecture-library/host-api.md`. Confirm three things, and record the answer in `## Answer`:
   - the tab registry accepts a page kind that names no resource pattern;
   - a guide entry renders with an icon and a title;
   - a dock pane body can reach the session on screen and open a resource.
2. Register the tab type. `id` is the implementation identity and is also the key for the body and title registrations. `kind` is `lectures`.
3. Register the body at the dock pane slot, keyed by the same id. Exclude nothing else; the body in this ticket renders one placeholder line.
4. Register the guide entry so the Start page holds one Lectures card.
5. Make the page single-instance: a second open focuses the tab that already exists.
6. Add one row to the `dsh.client.inject` list in `package.json` only if the host requires a declaration to deliver the dock registry. Name the row in the Answer either way. The host half and `cordis.patch.yml` stay untouched.
7. Wait for the registry through the plugin's service injection, so a host that lacks the dock shows nothing and does not throw.

## Fallback

If the installed host has no dock registry, stop and write the finding in `## Answer` before writing code. The fallback seat is a conversation view tab beside the existing Study tab, with the same list and the same preview call. Do not build the fallback in this ticket without saying so first.

## Tests

Extend `test/client.test.mjs` through the existing mount helper. Assert exactly:

- one dock tab type with kind `lectures`;
- one guide entry;
- one body registration under the same key as the tab type.

Do not assert on style values.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- The Answer records each verified host surface with the evidence that proved it.

## Validation owner

The implementer runs `npm test` and `npm run lint`. The merger checks that `client.inject` in `test/client.test.mjs` still matches the manifest.

## Answer

Correction: the Lectures tab type registers inside `ctx.inject(['sidebarRightTabs'], ...)`, not in the module-level `inject` array, so a host without the dock still registers the toggle, the settings section, and the Study tab.

The installed host has the dock registry. Evidence roots: `C:\Users\zhang\AppData\Local\Temp\opencode\dsh-asar\dsh\node_modules\@deepseek-ai\`. All line numbers below refer to those installed files.

### 1. A page tab type accepts no resource pattern

`dsh-client-ui-sidebar-right/README.md`, Extension seats, item 1, says the registry takes `{ id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted? }` and that "a page type — the guide, a file tree — names none and is opened by kind". The shipped guide proves it: `dsh-client-ui-sidebar-right/lib/client.js:4840-4846` registers `{ id, kind, priority: "builtin", title: () => ... }` with no `patterns`.

The exact shape used here:

```js
ctx.sidebarRightTabs.register({
  id: 'dsh-nerd-mode/lectures',
  kind: 'lectures',
  title: () => 'Lectures',          // function, called by the host
  guide: [{ id: 'lectures', order: 40, title: () => 'Lectures', description: () => '...', icon: Glyph }],
})
```

`patterns` is absent. `priority` is absent, so the registry's default band (extension) applies. `multiple` is absent, which is what makes the page single-instance: `lib/client.js:2298-2306` records a `multiple` type at `sidebar://<kind>/<uuid>` but an ordinary type at the fixed `pageAddress(kind)` (`sidebar://<kind>`, `lib/client.js:719-721`). The dockkit open path then finds the tab with that content id and focuses it instead of adding a second. `register` returns a disposer (`lib/client.js:4580-4610`), held inside `ctx.effect`.

### 2. A guide entry renders a card with a glyph and a title

The working example is `dsh-client-ui-sidebar-files/lib/client.js:22-37`:

```js
guide: [{
  id: 'workspace',
  commandId: 'workspace.files',
  order: 10,
  title: () => t('guide.title'),
  description: () => t('guide.description'),
  icon: GuideArtworkFiles,
}]
```

`id` is unique inside the provider, `order` sorts the card, `title` and `description` are functions, and `icon` is a component. The registry adds `kind` and `providerId` itself (`sidebar-right/lib/client.js:4734-4738`), so the entry never names the kind. The standard card is `EntryBox` (`sidebar-right/lib/client.js:517-548`): it takes `const Icon = entry.icon ?? CubeGlyph`, renders `<Icon size={22 or 26} />`, then `entry.title()` and `entry.description?.()`. A card without an `icon` still renders with the guide's cube placeholder; this ticket supplies a local book glyph component, so no new dependency is needed. Picking a card calls `tab.actions.openTab(entry.kind, { replaceTab: true })` (`sidebar-right/lib/client.js:633,647`).

### 3. Body slot name, registration shape, and key

The slot is `sidebar.right.pane.tab`, declared by the dock as a keyed session-scoped seat (`sidebar-right/lib/client.js:5046-5050`: `{ kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: tabInfoFactory } } }`). The README, Extension seats item 2, gives the registration shape: `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: definition.id }, Body)`. The working example is `sidebar-files/lib/client.js:1003-1013` with `key: FILES_ID`; the shipped guide uses `key: GUIDE_ID` (`sidebar-right/lib/client.js:5101-5103`).

The key is the tab type's `id`, not its `kind`. This ticket uses `dsh-nerd-mode/lectures` for both the type `id` and the body `key`.

### 4. `package.json` `dsh.client.inject` needs no row

`dsh.client.inject` is load-order metadata, not the service handshake. `dsh-client-modules/lib/client.js:776-793` (`arriveGraphRow`) walks each `row.inject` entry and loads that package's bundle before the consumer. The service handshake is the plugin's own exported `inject` array: cordis holds `apply` until every named service exists. The working example lists `sidebarRightTabs` and `sidebarRight` in its module `inject` array (`sidebar-files/lib/client.js:934-941`), and the dock provides them with `ctx.reflect.provide("sidebarRightTabs", tabs)` and `ctx.reflect.provide("sidebarRight", controller)` (`sidebar-right/lib/client.js:4965-4966`).

Therefore `package.json` stays untouched. The tab type registers inside `ctx.inject(['sidebarRightTabs'], ...)`, so only that registration waits. The module `inject` array keeps its five original services, and the pinned assertion at `test/client.test.mjs:355` stays unchanged. On a host without the dock the page registers nothing. The toggle, the settings section, and the Study tab keep working.

### 5. Session on screen, and opening a resource

The seat is session-scoped, so `sessionId` arrives as a standard prop; a body does not borrow it from a conversation slot and does not require a session package. `sidebar-files/lib/client.js:595` destructures `sessionId`, `useSessions`, and `useTabInfo`, and line 605 reads `useSessions((sessions) => sessions.byId[sessionId]?.cwd)`. The Session Inspector page uses the same source: `ctx.sessions.binding(sessionId)` from the keyed seat (`dsh-experimental-session-inspector/lib/client.js:4145-4151`).

To open a lecture, the body uses `useTabInfo().tab.actions.openResource(address)` (`sidebar-files/lib/client.js:650` calls `tabActions.openResource(...)`). `tabInfoFactory` returns `tab.actions` (`sidebar-right/lib/client.js:4856-4880`), and those actions target the tab's own Session even after the user switches Sessions (controller docs, `sidebar-right/lib/client.js:2108-2111`). The address is the session file address the preview package builds, `dsh-resource://file/session/<sessionId>/<encoded path>` (`sidebar-documentpreview/lib/client.js:54-57`). The text preview claims `dsh-resource://file/[\s\S]+` and accepts it only when the scope is `session` (`sidebar-documentpreview/lib/client.js:1079-1087`).

For ticket 02, the body registration therefore needs `inject: (sessionId) => ({ sessionId, workspaceFiles: ctx.remote.workspaceFiles })`; `workspaceFiles` is not a standard prop. Reads then call `ctx.remote.workspaceFiles.list(sessionId, path)` and `.read(sessionId, path, {})`, exactly as `StudyView` does.

### Delivered

- One tab type: id `dsh-nerd-mode/lectures`, kind `lectures`, no `patterns`, no `multiple`.
- One guide entry: id `lectures`, order 40, local book glyph.
- One body registration: `sidebar.right.pane.tab`, key `dsh-nerd-mode/lectures`, one placeholder line inside a region named Lectures.
- `package.json` and `cordis.patch.yml` untouched.
- `npm test`: 73 tests pass (70 before this ticket). `npm run lint`: clean.

