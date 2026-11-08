# Host API surfaces for the Study Sessions panel

Verified against the installed host: `@deepseek-ai/dsh-*` 0.2.1-rc.5 inside
`D:\DSH\resources\app.asar`, Node 22.21.1, plus the installed Context Insights
plugin `dsh-context` 0.81.0. Every claim below carries a path and a line.

Read-only extract used for the line numbers:

- `HOST` = `C:\Users\zhang\AppData\Local\Temp\opencode\dsh-asar-host`
- `PROFILE` = `C:\Users\zhang\.dsh\profiles\desktop\node_modules`
- `WEB` = `C:\Users\zhang\AppData\Local\Temp\opencode\web-index.js` (extracted
  `@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js`; one minified
  line, so those citations give a byte offset)

---

### 1. `sidebar.panellist`

**Declaration.** The sidebar declares the list at `HOST\dsh-client-ui-sidebar\lib\client.js:627`:
`"sidebar.panellist": { kind: "list", scope: "root" }`. A root-scoped list, so
any client plugin may add one entry.

**Registration shape.** Shipped examples:

- `HOST\dsh-client-ui-plugin-manager\lib\client.js:4484` — `id: PANEL_ID, order: 0, label: () => t("panel"), locale: NS`
- `HOST\dsh-client-ui-schedule\lib\client.js:7484` — `id: PANEL_ID ("schedules", line 7363), order: 10, locale: MANAGER_NS, label: () => t("panel")`
- `PROFILE\dsh-context\lib\client.js:31` — `id: "dsh-context", order: 20, label: () => r("ov.title"), locale: i` (`su = "dsh-context"` on the same line)

Shape:

```js
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
  name: 'sidebar.panellist',
  id: 'study-sessions',
  order: 30,
  label: () => boundT('panel'),   // string or function; resolved per render
  locale: NS,                     // optional; supplies the `t` prop
}, IconComponent))
```

`ctx.slots.inject(name, cb)` runs `cb` when the slot is declared, now or later,
and owns the returned disposer (`HOST\dsh-client-ui-renderer\lib\client.js:1354`).

**Options the sidebar reads.** `HOST\dsh-client-ui-sidebar\lib\client.js:568`:

```js
const next = ctx.slots.entriesOfSlot('sidebar.panellist').map(({ options }) => ({
  id: options.id,
  order: options.order ?? 0,
  label: resolveSlotLabel(options.label) ?? id,
})).sort((a, b) => a.order - b.order)
```

- `id` is required and is the addressing key.
- `order` defaults to `0`, sorted ascending, stable.
- `label` is a string or a function `() => string`; `resolveSlotLabel` is
  `typeof e === 'function' ? e() : e` (`WEB` offset 494291).
- Labels re-resolve on every locale change: `ctx.locale.subscribe(syncPanels)`
  at line 584. The label closure must own its translate function. The `t` prop
  belongs to the component, not to the label.

**Props the icon component receives.** `HOST\dsh-client-ui-sidebar\lib\client.js:226`:

```js
renderSlot('sidebar.panellist', {
  size: wide ? 16 : 18,   // 16 expanded, 18 in the collapsed rail
  active,                 // true when this panel is selected
}, { only: id })
```

So the icon gets `size`, `active`, the root standard hooks (`useSessions`,
`useSessionStatus`), `t` when `locale` is declared, and any `inject` result.
`dsh-context` reads only `size`: `e => createElement(T, { size: typeof e.size === 'number' ? e.size : undefined })`.

**Order 30.** Context Insights uses 20. Rows render in one sorted list, and the
More button is appended after that list, not sorted into it
(`HOST\dsh-client-ui-sidebar\lib\client.js:471` and `:479`). Order 30 therefore
sits after Context Insights and before More. More renders only while
`sidebar.panellist.actions` has a registration (`hasEntryActions`, line 587).

Installed plugins use no order between 20 and 30: `dshmarket` uses 1
(`PROFILE\dshmarket\client\client.js:18347`), `@xmanrui/dsh-im` uses 10
(`PROFILE\@xmanrui\dsh-im\lib\client.js:25223`). A tie would fall back to
registration order.

---

### 2. `main` keyed page

**Declaration.** The layout owns the slot at
`HOST\dsh-client-ui-layout\lib\client.js:631`: `"main": { kind: "keyed", scope: "root" }`,
as a child of the root registration.

**Render.** `HOST\dsh-client-ui-layout\lib\client.js:119`:

```js
renderSlot('main', {}, { entryKey: usePanelInfo(i => i.activePanelId) ?? 'conversation' })
```

`conversation` is the reserved key for the Conversation. An entry passes no
owner props.

**Registration shape.** `HOST\dsh-client-ui-schedule\lib\client.js:7473` and
`PROFILE\dsh-context\lib\client.js:31`:

```js
ctx.slots.inject('main', () => ctx.slots.register({
  name: 'main',
  key: 'study-sessions',
  locale: NS,          // optional; supplies `t`
  inject: () => ({ /* plain props */ }),
}, PageComponent))
```

The same id string must be the `sidebar.panellist` id and the `main` key. The
sidebar addresses `main` by that id (`HOST\dsh-client-ui-sidebar\README.md:38`).

**Props the page body receives.** Composition order is
`HOST\dsh-client-ui-renderer\lib\client.js:793`:

```js
jsx(Comp, { ...kit, ...injected, ...slotInjected.props, ...ownerProps })
```

- `kit` (`:737`): every root standard hook, `renderFactorySlot`, `t` when the
  entry declares `locale`, `useStore`/`actions` when the entry declares a
  store, and `renderSlot` only when the entry declares children. Our entry
  declares none, so `renderSlot` is absent. Do not destructure it.
- `injected`: the entry's own `inject(...)` result.
- `slotInjected.props`, `ownerProps`: empty for `main`.

Root standard hooks are merged from every `ctx.slots.provideRoot({ hooks })`
call (`HOST\dsh-client-ui-renderer\lib\client.js:1682`) and exposed as
`use<Name>` by `standardHookPropName`: `` `use${name[0].toUpperCase()}${name.slice(1)}` ``
(`WEB` offset 494155). The shipped sources:

| Prop | Source |
|---|---|
| `useSessions` | `hooks: { sessions: ctx.sessions.list }` — `HOST\dsh-client-ui-session\lib\client.js:1104` |
| `useSessionStatus` | same call, `sessionStatus: service.sessionStatus` |
| `useWorkspaces` | `hooks: { workspaces: workspaces.list }` — `HOST\dsh-client-ui-workspace\lib\client.js:5040` |
| `usePanelInfo` | `hooks: { panelInfo: layout.panelInfo }` — `HOST\dsh-client-ui-layout\lib\client.js:621` |

`locale` is a namespace name, not a prop. `t` is bound from it:
`kit["t"] = localeSeat(face, entry.locale)` (`HOST\dsh-client-ui-renderer\lib\client.js:746`).
Declaring `locale` without an installed locale face throws a
`SlotAssemblyError`. The namespace must be registered by the plugin with
`ctx.locale.register(ns, { zh, en })` (`HOST\dsh-client-locale\README.md:38`).

**`ctx.layout.selectPanel(id)`.** `HOST\dsh-client-ui-layout\lib\client.js:468`:

```js
selectPanel(panelId) {
  if (panelId !== null && !this.hasMainPanel(panelId))
    throw new Error(`layout.selectPanel: main panel "${panelId}" is not registered`)
  this.navigation.abort()
  this.panels.selectPanel(panelId)
}
```

- Key registered: aborts any pending navigation and sets `activePanelId`. The
  frame re-renders `main` with that key.
- Key not registered: throws, and the current selection stays. `null` returns
  to the Conversation.
- If the entry unregisters while selected, `retainMainPanels` resets the
  selection to `null` (`:411`, `:614`, `:689`).

**Clicking a sidebar row does not touch the session.** The sidebar calls only
`ctx.layout.selectPanel(id)` (`HOST\dsh-client-ui-sidebar\lib\client.js:597`).
`openSession` is what changes the session; see item 4.

---

### 3. The `useSessions` snapshot

**Provider.** `ctx.sessions.list` is an observable snapshot store, published as
a root hook at `HOST\dsh-client-ui-session\lib\client.js:1104` and backed by
`rootCtx.reflect.provide("sessions", this)` at
`HOST\dsh-api-session-controller\lib\client.js:3841`.

**Snapshot fields.** `HOST\dsh-api-session-controller\lib\client.js:4222`:

```js
this.list.set({ ids, byId, phase, projectionsBySession })
```

- `ids`: array of session id strings, in host order.
- `byId`: plain object, id to row.
- `phase`: `'pending'` then `'ready'`.
- `projectionsBySession`: extra map. Ignore it; the spec does not need it.

**Row fields.** `HOST\dsh-api-session-controller\lib\client.js:4154`:

```js
byId[entry.sessionId] = {
  id, displayTitle, running, retainedBy, blank, updatedAt, formatStatus,
  ...(projectionValues ? { projectionValues } : {}),
  ...(title ? { title } : {}),
  ...(cwd !== undefined ? { cwd } : {}),
  ...(parentSessionId ? { parentId } : {}),
  ...(origin ? { origin } : {}),
}
```

- `id`: string.
- `displayTitle`: string, always present.
- `updatedAt`: number (ms), always present. It is
  `Math.max(summary.updatedAt, sessionListMetadata.lastPromptAt ?? 0)` (`:3595`).
- `cwd`: **absent** when the host has none. Guard it before `basename(cwd)`.
- `blank`: boolean, always present. `blank: true` means no prompt was accepted yet.
- `projectionValues`: **absent** until the host sends projections for that
  session. Guard it with optional chaining.

**Title fallback chain.** `HOST\dsh-api-session-controller\lib\client.js:3701`:

```js
function displayTitleOf(title, cwd, id) {
  if (title !== undefined) return title
  if (cwd !== undefined && cwd !== '') { const base = workspaceTitleOf(cwd); if (base !== '') return base }
  return id
}
```

Durable title, then the cwd basename, then the raw session id. Subagent rows use
`projectionValues.title ?? child.label ?? childId` (`:4174`).

**`phase` while loading.** `'pending'`: `listPhase = "pending"` at `:2981`,
promoted to `"ready"` on the first successful pull (`:3269`). Treat
`phase !== 'ready'` as loading. `listState` (`'idle'`, `:2979`) is a separate
field and is not exposed in the snapshot.

**The switch state.** `projectionValues` is keyed by projection key. Nerd Mode
registers key `studyMode` (`C:\Users\zhang\.dsh\dev-dsh\study-plus-dsh\lib\fold.js:10`)
with `wire.view: (state) => ({ active: state.active })`
(`C:\Users\zhang\.dsh\dev-dsh\study-plus-dsh\lib\index.js:161`). So
`row.projectionValues?.studyMode?.active` is the live switch. An absent value
means off for display.

---

### 4. `uiWorkspace.openSession(id)`

**Service.** `super(ctx, "uiWorkspace")` at
`HOST\dsh-client-ui-workspace\lib\client.js:1380`.

**The call.**

```js
openSession(target) { this.replaceMain(target, this.lifetime.signal, 'reveal') }
```

`HOST\dsh-client-ui-workspace\lib\client.js:1471`. `replaceMain` (`:1652`)
retains the session as `{ source: 'mainView' }`, writes the selection, releases
the previous main reference, and ends with:

```js
if (panel === 'reveal') this.ctx.layout.selectPanel(null)   // :1674
```

**What the caller sees.** A synchronous call, which returns `undefined`. It
retains the session as the main view, records the selection, and clears the
global panel, so the main area shows that conversation. The panel needs no
close call.

The call can throw. `retain` throws when the session controller is disposed or
when the target does not resolve (`HOST\dsh-api-session-controller\lib\client.js:3843`).
Wrap a click from a possibly stale row in `try/catch`.

**Reachable without `inject`.** `ctx.get(name)` returns the value or
`undefined` and does not throw —
`get(e,t=!0){ return Cr(this.ctx, this._getImpl(e,t)?.value) }` (`WEB` offset
~17669). Property access is the form that throws:
`cannot get property "<name>" without inject` (`WEB` offset ~16475).

Two shipped proofs of the `ctx.get` form:

- `HOST\dsh-client-ui-sidebar\lib\client.js:602` calls
  `ctx.get("productAnalytics")?.track(...)`, and its `inject` list at `:550`
  does not name `productAnalytics`.
- `PROFILE\dsh-context\lib\client.js:24` calls `e.get("uiWorkspace")` and guards
  the result.

Use `ctx.get('uiWorkspace')?.openSession(id)`, or take it from a slot `inject`
face.

---

### 5. `webServer.register`

**Service.** `super(ctx, "webServer")` at
`HOST\dsh-host-webserver\lib\index.js:286`.

**Route shape and disposer.** `HOST\dsh-host-webserver\lib\index.js:326`:

```js
register(route) {
  const table = route.kind === 'exact' ? this.exact : this.prefixes
  if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
  table.set(route.path, route)
  return () => { table.delete(route.path) }
}
```

Dispatch (`:378`): match the raw pathname with no query string, exact map first,
then longest prefix (`:494`), then `await route.handler(req, res)`. With no
matching route the fallback seat runs; with no fallback the server replies
`404` with an empty body (`:389`).

**Shipped route shapes.** `HOST\dsh-client-connection\lib\index.js`:

```js
{ kind: 'exact', path: CONNECT_PATH, handler: (req, res) => { connection.authorizeConnect(req, res) } }   // :1059
{ kind: 'prefix', path: API_PATH, handler: async (req, res) => { ... } }                                   // :1045
```

`register` applies no method filter and no auth fence. The handler owns both.

**Disposer tied to the plugin.** The host registers inside an effect and lets
the effect return the disposer (`HOST\dsh-client-connection\lib\index.js:1058`):

```js
webCtx.effect(() => webCtx.webServer.register(route), 'client-connection: /connect route')
```

**A host without `webServer` still loads the plugin.** The shipped precedent is
`HOST\dsh-client-connection\lib\index.js:1035`:

```js
ctx.inject(['webServer'], (webCtx) => {
  webCtx.effect(() => webCtx.webServer.register(route), '...')
})
```

`ctx.inject(deps, cb)` forks a fiber that waits for the dependency
(`WEB` offset ~28856: `inject(e,t){ return this.plugin({ inject: e, apply: t, name: t.name }) }`).
`apply` keeps running, and the route appears when the service appears. This
repo already uses the form at `C:\Users\zhang\.dsh\dev-dsh\study-plus-dsh\lib\index.js:201`.

Use the injected `webCtx.webServer`, not `ctx.webServer`. Property access on a
ctx without the dependency throws (`WEB` offset ~16475). Add `connection` to the
same array, or read `ctx.get('connection')`.

**`ctx.connection.requestRejection(req)`.** It exists at
`HOST\dsh-client-connection\lib\index.js:737`:

```js
requestRejection(request) {
  const admission = this.admit(request)
  return 'rejection' in admission ? admission.rejection : undefined
}
```

`admit` (`:742`) returns `{ rejection: 403 }` when the Host/Origin fence fails,
`{ rejection: 401 }` when the server is disposed, and `{ rejection: 401 }` when
no valid browser cookie or API credential arrives. Otherwise it returns
`{ peer }`.

Return values: `undefined`, `401`, or `403` (numbers).

**The reply the host sends.** `HOST\dsh-client-connection\lib\index.js:864` and `:1051`:

```js
res.writeHead(admission.rejection)
res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden')
```

The spec says "replies 403 on rejection". Send the returned code instead, so a
missing cookie reads as 401.

---

### 6. The same-origin client call

**Which fetch options carry the cookie.** None. The browser sends it by default
for a same-origin request, which is `credentials: 'same-origin'`. The shipped
client does exactly that (`HOST\dsh-client-connection\lib\client.browser.js:1221`):

```js
const response = await send(`${channel}/${endpoint}`.slice(1), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(message),
  ...(signal === undefined ? {} : { signal }),
})
```

No `credentials` field appears in any shipped client bundle.

The cookie is `HttpOnly; SameSite=Strict; Path=/`, plus `Secure` on a TLS
listener (`HOST\dsh-client-connection\lib\index.js:347`):

```js
`${name}=${value}; Max-Age=${maxAge}; Path=/; Expires=${expires}; HttpOnly; SameSite=Strict`
```

Its name is `dsh-auth-` followed by `base64url(sha256(host authority))` (`:277`,
`:335`). JavaScript cannot read it. A cross-origin URL cannot send it, because
`SameSite=Strict` blocks that. Fetch a relative path such as
`/dsh-nerd-mode/api/study-sessions?cursor=0`.

**When the route is not registered.** The request falls to the fallback seat,
claimed by `dsh-host-frontend-static`
(`HOST\dsh-host-frontend-static\lib\index.js:88`). That handler serves GET and
HEAD files under the dist root only. A non-existent path answers
`res.writeHead(404); res.end()` (`:69`), an empty body. Any other method answers
`405` (`:89`).

The client must therefore treat `404`, `405`, an empty body, and a non-JSON
body as "route missing" and show the failure line. `response.json()` on the
empty body throws.

---

### 7. Session logs

**Path shape, on this machine.** `C:\Users\zhang\.dsh\sessions` holds 10
workspace-slug directories and 201 session directories, 89.9 MB in total.
Every session directory holds exactly one file, `session.v4.jsonl.zstd`. No
other file name occurs. Example:
`C:\Users\zhang\.dsh\sessions\--C-Users-zhang-.dsh--\025f3668-51d0-4b91-ace6-e92f6f2fbab8\session.v4.jsonl.zstd`.

**The frame-splitting recipe works.** On that 38,974-byte file the magic-byte
scan finds 9 frames, starting at offset 0, and decoding each frame yields 25
events. The first event is the header:

```json
{"type":"session","version":4,"id":"025f3668-...","createdAt":1792744762209,
 "cwd":"C:\\Users\\zhang\\.dsh","parentSession":"session-606f...","isSeeded":false,
 "origin":"subagent","delegationDepth":1,"agentPreset":"general"}
```

**The whole-file call stops at the first frame.** `zstdDecompressSync(bytes)`
on the same file returns 1 line, the header. Frame splitting is required, not
optional.

**`node:zlib` on this Node.** `zstdDecompressSync` is a function on v22.21.1
(`typeof zlib.zstdDecompressSync === 'function'`), so `node:zlib` alone decodes
the files. No extra dependency.

**Scan caveat.** The magic bytes can occur inside a compressed frame. Decode
each candidate frame in a `try/catch` and drop a frame that fails, rather than
trusting the scan. The recipe's warning in
`docs\agents\dsh-session-api.md` holds.

---

### Corrections to the spec

1. **`main` also needs `name: 'main'`.** The spec lists `key`, `locale`, and
   `inject`. Every shipped registration passes `name` too.
2. **`sidebar.panellist` also needs `name: 'sidebar.panellist'`.** The spec lists
   `id`, `order`, and `label`.
3. **The `label` function owns its translator.** The slot's `t` prop goes to the
   icon component, not to the label closure. Bind a translate function from the
   plugin's own `ctx.locale.bind(ns)` and close over it, as `dsh-context` does
   with `() => r('ov.title')`.
4. **Order 30 is right, but the shipped order list is incomplete.** `dshmarket`
   registers order 1 and `@xmanrui/dsh-im` order 10. Neither lands between 20 and
   30, so the placement holds.
5. **"More" is conditional.** The More button renders only while
   `sidebar.panellist.actions` has an entry. With none, the Study Sessions row is
   simply last.
6. **`useSessions` state has a fourth field.** It is `{ ids, byId, phase,
   projectionsBySession }`, not `{ ids, byId, phase }`.
7. **`cwd` and `projectionValues` are optional on a row.** Both are spread in
   only when present. Read `row.cwd` and `row.projectionValues?.studyMode?.active`
   with guards. `blank` and `updatedAt` are always present.
8. **`phase` is `'pending'` while loading, then `'ready'`.** Only those two values
   occur on this field.
9. **Rejection is 401 as well as 403.** `requestRejection` returns `undefined`,
   `401` (no valid cookie, or the connection is disposed), or `403` (Host/Origin
   fence). Reply with the returned code, and send `unauthorized` or `forbidden`
   as the body to match the host.
10. **The optional `webServer` is a fork, not a manifest change.** The top-level
    `inject` export is the required list. Adding `'webServer'` there would gate
    the whole plugin on it. Keep `inject` unchanged and use
    `ctx.inject(['webServer', 'connection'], (webCtx) => ...)` inside `apply`.
11. **`ctx.webServer` is not readable on the unforked ctx.** Inside the fork use
    the injected `webCtx`. Outside it, `ctx.get('webServer')`.
12. **An unregistered route replies 404 with an empty body, not JSON.** The
    frontend-static fallback owns the seat. The client must treat that, and 405
    for a non-GET, as a missing route.

### Not verified

- I did not run the app, so the projection wire value was read from the plugin's
  `wire.view` and the client's `{ key, value }` frame handling, not from a live
  payload. `projectionValues.studyMode` is therefore confirmed by construction,
  not by observation.
- I did not confirm the desktop app's own webserver config (`host`, `port`,
  `tls`), so the "same origin" claim rests on the single listener and the single
  page origin, not on a config read.
