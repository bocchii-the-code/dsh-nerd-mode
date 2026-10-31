# Host API notes: the dock tab seat

Recorded from the installed host at
`C:\Users\zhang\AppData\Local\Temp\opencode\dsh-asar\dsh\node_modules\@deepseek-ai\`.

The dock is `@deepseek-ai/dsh-client-ui-sidebar-right`. Every fact below was read
from that package, from `dsh-client-ui-sidebar-files` (a live page tab type), or
from `dsh-client-ui-sidebar-documentpreview` (a live resource viewer).

## Tab type

```js
ctx.effect(() => ctx.sidebarRightTabs.register({
  id, kind, title: () => '<chip text>', guide: [{ id, title: () => '<card title>', order }],
}))
```

- `id` is required, unique across every registration, and is also the key the body registers under.
- `kind` is required. A page type names no `patterns` and is opened by kind.
- `title` is a function. Its return value is captured into the tab record when the tab opens.
- `guide[].title` is a function. `icon` is an optional component. Without `icon` the guide draws its own cube placeholder.
- The registration returns an idempotent disposer.

## Page body

```js
ctx.slots.register({ name: 'sidebar.right.pane.tab', key: <same id>, inject: (sessionId) => ({...}) }, Body)
```

That seat is keyed and session-scoped. Three things arrive as standard props, and
none of them is a `require`:

- `sessionId` — the Session the tab belongs to.
- `useSessions` — a selector hook. The working directory is `useSessions((s) => s.byId[sessionId]?.cwd)`.
- `useTabInfo` — `const { tab } = useTabInfo()`. `tab` carries `id`, `kind`, `contentId`, `title`, `visible`, `navigation`, `signal`, `actions`.

`workspaceFiles` is not a standard prop. Pass it through the registration's `inject` factory.

## Opening a resource

```js
tab.actions.openResource(address, { preferNewPane: true })
```

`preferNewPane` asks for a split first and falls back to the target pane, which is
what "opens beside my current tab" means. `openResource` throws when the address is
not a `dsh-resource://` address or no type claims it.

## File address

`fileAddressFor(sessionId, cwd, path)` lives in `@deepseek-ai/dsh-util-workspace-path`.
It returns `dsh-resource://file/session/<encoded sessionId>/<encoded path>`, where the
path is made relative to `cwd` when it sits inside it.

That package is a plain library with no service. The shipped file-tree viewer had it
inlined by its bundler. A plain client plugin cannot rely on the browser module table
carrying it, so the panel carries the same builder as a local function. Copy it
verbatim, name its source in a comment, and pin its output in a test.

## Service access

`dsh.client.inject` in `package.json` is load-order metadata only. Service access
comes from the client module's own `inject` array, which must list `sidebarRightTabs`
and `sidebarRight`. The dock package provides both with `ctx.reflect.provide`.

## Workspace file remote

`ctx.remote.workspaceFiles` is namespace `@deepseek-ai/dsh-api-workspace-files`.

- `list(sessionId, path)` returns `{ ok: true, value: { path, entries, truncated } }` or `{ ok: false, error: { code, message } }`. `entries` carries `{ name, type: 'file' | 'directory' | 'other' }`. The entry cap is 2000 and is reported only as `truncated`.
- `read(sessionId, path, range?)` returns `{ ok: true, value: { text, offset, lines, eof, ... } }`.
- Error codes are prefixed `workspace-file/`: `not-found`, `outside-workspace`, `too-large`, `not-text`, `not-regular-file`, `not-directory`, plus `unknown-workspace` and `unsupported-address`.
- A path may be absolute or workspace-relative.

The existing `readText` helper in `client.js` already treats `workspace-file/not-found` as an empty input. Reuse it.
