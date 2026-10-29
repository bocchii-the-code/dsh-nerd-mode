# A sidebar entry that opens a full page in the `main` slot

Research note for issue #5. It records what the shipped code does. It decides nothing.

## Sources and citation shorthand

`$UI` stands for the local install root:

```
C:\Users\zhang\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai
```

Every citation below is a path under `$UI` unless it starts with `./` (this repo). Line numbers are from the shipped bundles and declaration files.

`@deepseek-ai/dsh-client-ui-slots` is not present in this install (`$UI/dsh-client-ui-slots` does not exist), so these types cannot be read: `PropsRuntime`, `SlotCore.register`, `resolveSlotLabel`, `SlotMap` option shapes. The answers below rest on shipped call sites, shipped `.d.ts` files of the consuming packages, and the shipped renderer that consumes the registry. Anything that is a conclusion rather than a quotation is marked **INFERENCE**.

The reference implementation is `@deepseek-ai/dsh-client-ui-schedule`. The second reference is `@deepseek-ai/dsh-client-ui-plugin-manager`, the only other shipped package that fills both seats.

---

## 1. The exact `ctx.slots.register` calls

Both seats come from one `apply(ctx)` body in `$UI/dsh-client-ui-schedule/lib/client.js`:

```js
const PANEL_ID = "schedules";                                   // :7363
ctx.slots.inject("main", () => ctx.slots.register({             // :7473
    name: "main",
    key: PANEL_ID,
    locale: MANAGER_NS,
    inject: () => ({
        ...detail,
        onNewTask: () => { ctx.uiWorkspace.startSession(); }
    })
}, TaskManagerPage));                                           // :7483
ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({// :7484
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 10,
    locale: MANAGER_NS,
    label: () => t("panel")
}, TaskManagerIcon));                                           // :7490
```

The second reference uses the same two shapes with `order: 0` and a plain label function: `$UI/dsh-client-ui-plugin-manager/lib/client.js:4417` (main) and `:4477` (panellist), `PANEL_ID = "plugins"` at `:4355`.

### Field by field

| field | `main` | `sidebar.panellist` | evidence |
|---|---|---|---|
| `name` | `"main"` | `"sidebar.panellist"` | schedule `client.js:7474`, `:7485` |
| `key` | required: the panel id the renderer matches | not used | renderer matches only on `options.key`, `$UI/dsh-client-ui-renderer/lib/client.js:1179` |
| `id` | not used | required: the row id, and the main key it addresses | sidebar reads `options.id`, `$UI/dsh-client-ui-sidebar/lib/client.js:455`; `$UI/dsh-client-ui-sidebar/README.md:38` |
| `order` | not used | number, default `0`, ascending, ties keep registration order | sidebar `client.js:458`, `:461`; `$UI/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:104` |
| `label` | not used | visible text, accessible name, collapsed tooltip; string or function | sidebar `client.js:459`; `$UI/dsh-client-ui-sidebar/README.md:38` |
| `locale` | binds the `t` prop | binds the `t` prop | renderer `client.js:742-745` |
| `inject` | factory returning the page's face props | optional; both shipped icons pass none | schedule `client.js:7477`, `:7484-7490` |
| second argument | the page component | the icon component | schedule `client.js:7483`, `:7490` |

The asymmetry is structural: `main` is a **keyed** slot (`$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:53-56`, declared by the frame at `$UI/dsh-client-ui-layout/lib/client.js:631-634`), so it is addressed by `key`. `sidebar.panellist` is a **list** slot (`$UI/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:46-50`), so it is addressed by `id` and placed by `order`.

### How the four things you named are set

- **Entry id**: `id: PANEL_ID` on the panellist entry, and the identical string as `key: PANEL_ID` on the main entry. The sidebar states the rule: "The same id addresses the component registered in the layout's root-scoped `main` keyed slot" (`$UI/dsh-client-ui-sidebar/README.md:38`).
- **Icon**: the panellist entry's component. It receives `{ size, active }` (`$UI/dsh-client-ui-sidebar/lib/client.js:190-193`; owner type at `contract/slots.d.ts:93-99`) and must be the glyph itself, not a wrapper: the schedule icon's own doc comment explains that an inline wrapper becomes a line box and lifts the glyph out of the row's slot (`$UI/dsh-client-ui-schedule/lib/types/client/TaskManagerIcon.d.ts:3-9`). The shipped implementation renders one primitives glyph: `client.js:6874-6876`.
- **Label**: `label`, resolved through `resolveSlotLabel(options.label) ?? id` (`$UI/dsh-client-ui-sidebar/lib/client.js:459`). Schedule passes a bound translator `() => t("panel")`; a plain string is documented as acceptable (`$UI/dsh-client-ui-sidebar/README.md:38`).
- **Order**: `order` on the panellist entry only. Schedule uses `10`, plugin-manager `0`. Rows sort ascending by `order` with a stable sort (`$UI/dsh-client-ui-sidebar/lib/client.js:461`).

Both registrations are wrapped in `ctx.slots.inject(slotName, callback)`, which is the documented way to depend on a declaration whose owner may activate before or after this plugin (`$UI/dsh-client-ui-renderer/lib/types/client/registry.d.ts:96-111`; the reason is spelled out in `$UI/dsh-client-ui-workspace/lib/types/client/index.d.ts:26-33`). The callback's returned disposer is tied to the caller's fiber, so no `ctx.effect` wrapper is needed (`registry.d.ts:69-84`).

---

## 2. What a `main` page receives at root scope

`main` declares no owner props: the `SlotMap` entry has `kind` and `scope` and no `owner` (`$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:53-56`), and the frame renders it with an empty owner share, `renderSlot("main", {}, { entryKey })` (`$UI/dsh-client-ui-layout/lib/client.js:119`).

The renderer composes the props in this order, later shares winning (`$UI/dsh-client-ui-renderer/lib/client.js:773-790`):

1. the standard kit (`kit`, built at `:736-767`),
2. the entry's `inject` face (`injected`),
3. per-slot injected props,
4. contextual hook factories,
5. owner props (none here).

The standard kit contains, unconditionally:

| prop | source |
|---|---|
| every root `GlobalStandardProps` hook | `client.js:680-702`, `:738-739` |
| `renderFactorySlot` | `client.js:740` |

and conditionally:

| prop | condition | evidence |
|---|---|---|
| `t` | the entry declares `locale` | `client.js:742-746` |
| `useStore`, `actions` | the entry declares `store` | `client.js:747-752` |
| `renderSlot` (plus `renderSlotChain`, `SessionProvider`) | the entry declares `children` | `client.js:753-760` |

The root `GlobalStandardProps` roster, as declared by the shipped packages:

- `usePanelInfo` - `$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:29-32`
- `useSessions`, `useSessionStatus`, `useSessionRetainInfo`, `useSessionAccess` - `$UI/dsh-client-ui-session/lib/types/client/index.d.ts:72-79`
- `useWorkspaces`, `useWorkspaceAccess` - `$UI/dsh-client-ui-workspace/lib/types/client/index.d.ts:10-15` (also `$UI/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:413-416`)
- `useRemoteAccess` - `$UI/dsh-api-remote-access/lib/types/client/mount.d.ts:33-38`
- `useResource` - `$UI/dsh-client-resources/lib/types/client/contract.d.ts:20-25`

What it does **not** receive: `sessionId`, `useSession`, `useProjection`, `useAccess`. Those are `SessionStandardProps` (`$UI/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:417-424`; `$UI/dsh-client-ui-session/lib/types/client/index.d.ts:80-89`), and the `main` slot is root-scoped with no Session binding: "The reserved `conversation` key hosts the Conversation; other keys receive no Session binding" (`$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:49-52`).

The entry's own `inject` factory lands as ordinary props, with one convention: a `hooks.<name>` observable becomes a `use<Name>` selector hook. Schedule's injected face declares `hooks.catalog` (`$UI/dsh-client-ui-schedule/lib/types/client/TaskManagerPage.d.ts:6-16`) while the component destructures `useCatalog` (`client.js:6644`); the renderer binds every `hooks` source to a `use<Name>` hook (`$UI/dsh-client-ui-renderer/lib/client.js:724-734`; schedule `README.md:70`).

The page owns its own chrome. The frame publishes `--dsh-frame-top-clearance` for the reserved top strip, and "entry pages in the main panel (plugin manager and similar, not the conversation) pad their top by it" (`$UI/dsh-client-ui-layout/README.md:39`).

---

## 3. Active state, and how the page is left

### Active state

The sidebar row computes it itself; the entry component does not track it:

```js
function PanelRow({ id, label, wide, usePanelInfo, selectPanel, renderSlot }) {   // :173
    const active = usePanelInfo((info) => info.activePanelId === id);             // :174
    ...
    "aria-current": active ? "page" : void 0,                                     // :183
    onClick: () => { selectPanel(id); },                                          // :184-186
    children: [... renderSlot("sidebar.panellist", { size: wide ? 16 : 18, active }, { only: id })]
```

`$UI/dsh-client-ui-sidebar/lib/client.js:173-199`. The selected row also gets the `panelActive` class (`:181`). The icon receives the same `active` flag (`:192`), which both shipped icons ignore (`client.js:6874-6876`).

Clicking an already active row re-selects the same id. There is no toggle: `PanelRow` calls `selectPanel(id)` unconditionally (`:184-186`) and that call forwards to `ctx.layout.selectPanel(id)` (`$UI/dsh-client-ui-sidebar/lib/client.js:478-481`). A repeated valid selection is explicitly allowed (`$UI/dsh-client-ui-layout/README.md:57`).

A page can read its own selection state through `usePanelInfo`, since it is a root standard prop (`$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:29-32`).

### Leaving the page

The frame gives a panel page no back control. Leaving means setting `activePanelId` back to `null`, which the frame resolves to the reserved `conversation` key (`$UI/dsh-client-ui-layout/lib/client.js:118-119`).

The shipped route is Session navigation: `clearMain()` and `replaceMain(..., "reveal")` call `ctx.layout.selectPanel(null)` (`$UI/dsh-client-ui-workspace/lib/client.js:1644-1650`, `:1651-1673`). So choosing a Session in the sidebar returns the centre to the Conversation.

Schedule's page ships no close or back affordance. Its only Escape handler closes the *detail* level inside the page (`$UI/dsh-client-ui-schedule/lib/client.js:6695-6700`), and it never calls `selectPanel`. A plugin that wants an explicit "back to the conversation" control would call `ctx.layout.selectPanel(null)` itself (`$UI/dsh-client-ui-layout/lib/types/client/service.d.ts:27-32`), which needs the `layout` service in the module's cordis `inject` list. **INFERENCE**: no shipped main-panel page does this, so there is no shipped precedent for the control's shape.

Side effect worth knowing: while a panel is active the browser title falls back to the product title, because `DocumentTitle` shows the Session title only when `activePanelId === null` (`$UI/dsh-client-ui-layout/lib/client.js:57-64`).

---

## 4. Required `package.json` `dsh.client.inject` entries

The minimal shipped pair is `@deepseek-ai/dsh-client-ui-plugin-manager`, which fills exactly these two seats and declares four rows:

```json
"dsh": { "client": { "inject": [
  "@deepseek-ai/dsh-api-remotes",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-sidebar"
], "platform": "web" } }
```

`$UI/dsh-client-ui-plugin-manager/package.json:37-47`. Of those four, two are what the seats themselves need:

- `@deepseek-ai/dsh-client-ui-layout` - declares `main`, owns `ctx.layout` (`$UI/dsh-client-ui-layout/lib/client.js:623-653`).
- `@deepseek-ai/dsh-client-ui-sidebar` - declares `sidebar.panellist` (`$UI/dsh-client-ui-sidebar/lib/client.js:487-521`, list declaration at `:503-506`).

`@deepseek-ai/dsh-api-remotes` is there for that page's data; `@deepseek-ai/dsh-client-locale` is there because the page and the row are localized. If an entry declares `locale`, the locale face must be installed: the renderer throws `SlotAssemblyError` when an entry names a namespace and no locale face exists (`$UI/dsh-client-ui-renderer/lib/client.js:742-745`). An entry with no `locale` and a literal `label` needs neither.

Schedule's longer list (twelve rows, `$UI/dsh-client-ui-schedule/package.json:23-36`) covers its other surfaces: the right Sidebar, the conversation turn card, the Session rows, ui-tool, ui-workspace, primitives. Those rows are not required by the two seats.

What the field means, in the shipped words: "`inject` names package rows whose factories must arrive before this row materializes, while Cordis separately uses the same package edges to compose entries" (`$UI/dsh-client-modules/lib/types/client/manifest.d.ts:43-46`). And the ordering caveat: "`dsh.client.inject` edges are informational (loading/prefetch metadata, never apply sequencing)" (`$UI/dsh-client-ui-workspace/lib/types/client/index.d.ts:26-33`). Waiting for the declaration is `ctx.slots.inject()`'s job, not the manifest's.

Separate from the manifest, the module's own cordis `inject` array names services. `slots` is required for both seats. `layout` is required only if the code calls `ctx.layout`. Schedule's array has no `layout` (`$UI/dsh-client-ui-schedule/lib/client.js:7365-7377`), because its sidebar selection is performed by ui-sidebar itself.

This repo currently declares one row, `@deepseek-ai/dsh-client-conversation` (`./package.json:31-35`), and its module injects `slots`, `remote`, `remote.commands`, `configForms` (`./client.js:569`).

---

## 5. Constraints on `main` keys

| constraint | statement | evidence |
|---|---|---|
| reserved key | `conversation` is the Conversation; the frame falls back to it when the selection is `null` | `$UI/dsh-client-ui-layout/README.md:32`; `.../types/client/index.d.ts:49-52`; `client.js:118-119` |
| no Session binding | a key other than `conversation` receives no Session props | `.../types/client/index.d.ts:49-52` |
| key required | the outlet matches entries by `options.key` only; an entry without `key` is registered but never rendered | renderer `client.js:1178-1181`; the selection bookkeeping also skips keyless entries, `$UI/dsh-client-ui-layout/lib/client.js:615` |
| distinct id space | the id is a branded string type, not validated at runtime here | `$UI/dsh-client-ui-layout/lib/types/client/service.d.ts:14-15`; `LocalSlotOccupant` shape at `$UI/dsh-cordis-client-runner/lib/client.js:1958` |
| collision | one entry per cell wins; a duplicate key does not render a second page | renderer `client.js:1178-1181`; `entriesOfSlot` returns "the first live (non-abdicated) entry of each cell in priority order", `$UI/dsh-client-ui-renderer/lib/types/client/registry.d.ts:164-174` |
| missing key on select | `selectPanel` throws and leaves the current panel intact | `$UI/dsh-client-ui-layout/lib/client.js:468-469`; `.../types/client/service.d.ts:27-32`; `$UI/dsh-client-ui-layout/README.md:57` |
| unload | losing the active key resets the selection to `null` | `$UI/dsh-client-ui-layout/lib/client.js:410-412`, `:614-616`, `:689` |

Naming: no rule is documented. The two shipped ids are lowercase single words, `"plugins"` (`$UI/dsh-client-ui-plugin-manager/lib/client.js:4355`) and `"schedules"` (`$UI/dsh-client-ui-schedule/lib/client.js:7363`). Nothing found rejects other strings.

Collision winner: a later *dynamic* registration is assigned a lower priority number (`$UI/dsh-cordis-client-runner/lib/client.js:393`, `:615`), and the renderer's own note for the `root` slot describes the consequence: a dynamically registered entry "is assigned a lower priority than the shipped one, which makes it the winner" (`$UI/dsh-client-ui-renderer/lib/types/client/registry.d.ts:24-30`). **INFERENCE**: the same cell rule applies to a keyed `main` cell, so a plugin that registers an already-used key takes the page over rather than adding a second one. The static-versus-static case is not documented.

**INFERENCE**: registering the literal key `conversation` would shadow the shipped Conversation page under that same rule. No runtime check rejects it, and no shipped doc calls it an error.

---

## 6. Mount lifetime, and the data-loading pattern

### The page is not kept mounted

The outlet renders exactly one entry for a keyed slot, and it renders it under a React key derived from entry identity:

```js
if (spec.kind === "keyed") {
    const entry = host.entriesOfSlot(slotKey).find((e) => e.options.key === opts?.entryKey);   // :1179
    if (!entry) return ... ;
    return guarded(entry, entryKeyOf(entry));                                                   // :1181
}
```

`$UI/dsh-client-ui-renderer/lib/client.js:1178-1181`, with the identity key explained at `:591-610` and applied as the boundary key at `:1258`. **INFERENCE** (ordinary React behavior, not stated in the docs): when the selection moves to another key, the previous page unmounts, and it mounts fresh when selected again. The docs make the contrast explicit for the one seat that does survive navigation: "`shell.bottom` ... remains mounted across main-panel navigation" (`$UI/dsh-client-ui-layout/lib/types/client/index.d.ts:76-80`).

Consequence: page-local `useState` dies on every switch. Schedule's search text, filter, and selected task are `useState` (`$UI/dsh-client-ui-schedule/lib/client.js:6647-6649`), and its README notes the page "keeps its own list" (`$UI/dsh-client-ui-schedule/README.md:66`).

### The documented data pattern

State lives in a source built during `apply`, not in the component, and exposes a bare observable through the entry's `inject` face. Reads follow observers:

```js
subscribe(listener) {
    listeners.add(listener);
    if (listeners.size === 1) {
        lifecycle++;
        disposers = [deps.subscribeChanged(invalidate), deps.subscribeReset(invalidate)];
        invalidate();                       // first subscriber triggers the first read
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size !== 0) return;
        for (const dispose of disposers) dispose();
        disposers = [];
        epoch++;                            // late responses are dropped
    };
}
```

`$UI/dsh-client-ui-schedule/lib/client.js:113-136`. The type doc states the contract: "Create a catalog whose Remote subscriptions follow its framework subscribers" (`$UI/dsh-client-ui-schedule/lib/types/client/catalog-source.d.ts:81-90`).

So there is no `useEffect` on mount and no fetch in the page. The page calls the bound hook (`useCatalog`, `$UI/dsh-client-ui-schedule/lib/client.js:6644-6645`); the subscription that the renderer's hook creates is what starts the read, and remounting after a switch starts a fresh one. The README puts it as: "Subscriptions exist only while the framework observes a source" (`$UI/dsh-client-ui-schedule/README.md:70`).

Two details the snapshot carries so the first paint is honest: `status` starts at `"loading"` (`:21-28`), and `settled` distinguishes "never read" from "read and empty" because a refresh republishes `loading` over the last good records (`$UI/dsh-client-ui-schedule/lib/types/client/catalog-source.d.ts:14-22`).

---

## Registration skeleton

Pinned to `$UI/dsh-client-ui-plugin-manager/lib/client.js:4411-4483` (seats and service wiring) and this repo's module shape, `./client.js:1-4` and `:568-594`. Replace `study`, the components, and the injected face. No decision is implied by the placeholders.

```js
window.__ModuleLoader__.load({
  id: 'dsh-nerd-mode/client',
  factory(require) {
    const React = require('react');

    const PANEL_ID = 'study';           // one string, used as the panellist id AND the main key
    const LABEL = 'Study';              // plain string is accepted; or () => t('panel') with locale

    // The page. Receives root standard props only: usePanelInfo, useSessions,
    // useWorkspaces, useRemoteAccess, useResource, ... plus this entry's inject face.
    function StudyPage(props) {
      return React.createElement('section', {
        'aria-label': LABEL,
        // A main page owns its top clearance; the frame publishes this token.
        style: { paddingTop: 'var(--dsh-frame-top-clearance)', height: '100%', overflow: 'auto' },
      }, React.createElement('h1', null, LABEL));
    }

    // The sidebar icon. Receives { size, active }. Return the glyph itself,
    // not a wrapper: the row places it as the direct icon child.
    function StudyIcon({ size }) {
      return React.createElement('svg', {
        'aria-hidden': 'true', width: size, height: size, viewBox: '0 0 16 16',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
      }, React.createElement('path', { d: 'M2.5 2.5h11v11h-11z' }));
    }

    return {
      inject: ['slots'],                // add 'layout' only if the page calls ctx.layout
      apply(ctx) {
        // The page. `key` is what the frame matches; `id`/`order`/`label` mean nothing here.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          inject: () => ({}),           // face props; a hooks.<name> observable arrives as use<Name>
        }, StudyPage));

        // The sidebar row. `id` must equal the main `key`; order sorts ascending.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 10,
          label: LABEL,
        }, StudyIcon));
      },
    };
  },
});
```

Manifest rows for those two seats (see section 4):

```json
"dsh": {
  "client": {
    "platform": "web",
    "inject": [
      "@deepseek-ai/dsh-client-ui-layout",
      "@deepseek-ai/dsh-client-ui-sidebar"
    ]
  }
}
```

Add `@deepseek-ai/dsh-client-locale` if either entry declares `locale`, and `@deepseek-ai/dsh-api-remotes` if the page reads Host data.

---

## Facts this note could not establish

1. The `register` option list as a type. `@deepseek-ai/dsh-client-ui-slots` is missing from this install, so `SlotCore.register` and `PropsRuntime` cannot be read. The table in section 1 lists only fields observed in shipped calls plus ones the renderer and sidebar read.
2. `resolveSlotLabel`'s exact accepted input. It is called as `resolveSlotLabel(options.label) ?? id` (`$UI/dsh-client-ui-sidebar/lib/client.js:459`) and the sidebar README says "a string or locale-aware `label`" (`:38`), but the implementation is in the missing package.
3. Which entry wins when two statically loaded plugins register the same `main` key. Only the dynamic-versus-shipped case has a shipped statement (`$UI/dsh-client-ui-renderer/lib/types/client/registry.d.ts:24-30`).
4. Whether any runtime validation rejects a registration under the reserved `conversation` key. No such check was found in the shipped layout, sidebar, or renderer code.
5. Whether `registrant` is worth setting. It is an optional option that defaults to the fiber name (`$UI/dsh-client-ui-renderer/lib/client.js:1605`); this repo sets it once already (`./client.js:576`).
6. Whether a page must render its own scroll container. Both shipped pages do (`$UI/dsh-client-ui-schedule/lib/client.js:6704`, plus the page module CSS), but no written rule says the frame requires it.
