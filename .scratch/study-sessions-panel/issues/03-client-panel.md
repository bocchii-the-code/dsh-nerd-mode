# 03 — Add the Study Sessions sidebar entry and page

Status: ready-for-agent
Blocked by: 01

## Question

Which conversations are my study conversations? Show them in one global panel, grouped by Quick, In-depth, and Past, and open one on click.

## Scope

Read `.scratch/study-sessions-panel/spec.md`, sections **Seat**, **Client data**, **Grouping**, **Row**, **Refresh**, **Empty and failure states**, **Copy**, **Layout**, **Accessibility**, **Manifest**, and **Testing Decisions**. Read `.scratch/study-sessions-panel/host-api.md` for the verified host surfaces.

Deliver in `client.js`:

1. Two slot seats with id/key `study-sessions`:
   - `sidebar.panellist`: `id: 'study-sessions'`, `order: 30`, a label resolved through the active locale (`Study Sessions` / `学习会话`), and an inline SVG icon component that uses the `size` and `active` props. No `assets/` read.
   - `main`: `name: 'main'`, `key: 'study-sessions'`, and `inject`. Do not pass a `locale` namespace option unless you also register it with `ctx.locale.register`; the plugin's existing copy helper takes the `locale` service directly. Wrap both seats in `ctx.inject(['locale'], ...)` and use `useT(locale)` as the Settings section does. The host swaps the main area through `ctx.layout.selectPanel(id)`, so the panel adds no route and no modal.
2. The page component:
   - read the live list with `useSessions((state) => state)`; rows come from `ids`/`byId`, never from the index;
   - fetch `/dsh-nerd-mode/api/study-sessions?cursor=<n>` on mount and continue until `phase === 'ready'`, updating the progress line between calls. Treat `404`, `405`, an empty body, and a non-JSON body as a missing route and show the failure line (`host-api.md` item 6);
   - group `active && studyPlus` as In-depth, `active && !studyPlus` as Quick, and `!active` as Past. A missing live value counts as `active: false`;
   - Past is collapsed by default, with `aria-expanded` on its heading button, and each Past row keeps a Quick/In-depth chip;
   - each group heading is a level-two heading whose text includes the count, and a group with no rows is not rendered;
   - each row is one full-width button showing the title, `basename(cwd)`, and a relative time from `updatedAt` (locale-aware, `Intl.RelativeTimeFormat`); `ctx.get('uiWorkspace')?.openSession(id)` on click; rows sort by latest change;
   - empty, loading, and failure states exactly as the spec's table: one empty line with the `/nerd-mode on` hint, a status line `Scanning session history… {done} of {total}`, an alert line naming a failure, cached rows kept when a rescan fails, and the last good list kept in a module-level variable so a failed remount does not blank the page;
   - a region named from the page title, the title as `h1`, one column at 720 pixels maximum, theme alias variables only, no new colours;
   - all copy through `useT(locale)` and the spec's copy table. Follow a language switch without remounting.
3. `test/client.test.mjs`: one render test through the existing fake-context harness with four fake rows and a fake index. Assert the group headings and counts, the Past chip, the empty line, and a row's accessible name. Add one failure test: the route fails, cached rows stay, and the alert line names the failure. Extend `mount` with a fake `uiWorkspace` and a fake `useSessions` prop. Do not assert style values.
4. `package.json`: change `dsh.client.inject` only if `host-api.md` shows the sidebar or layout package must load first. Name the decision in the Answer.

Out of scope: Course files, Course progress, filters, live updates, refresh controls, session mutations, mobile layout.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- The panel renders with no index and with no `uiWorkspace`; it shows the empty or failure line instead of throwing.
- Toggle, settings, Study view, and Lectures keep working.

## Validation owner

The implementer runs `npm test` and `npm run lint`. The merger checks the copy table and the accessibility lines against the spec. The final review checks the manifest.
