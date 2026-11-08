# 02 — Build the session history index and its route

Status: ready-for-agent
Blocked by: 01

## Question

Which conversations had Nerd Mode switched on at least once, and which of those ran `/study-plus`? Serve that history to the panel in chunks.

## Scope

Read `.scratch/study-sessions-panel/spec.md`, sections **History data**, **Index**, **Scan**, **Classifying Nerd Mode**, **Classifying In-depth**, **Host route**, **Manifest**, and **Testing Decisions**. Read `.scratch/study-sessions-panel/host-api.md` for the verified host surfaces.

Deliver:

1. `lib/study-sessions.js`, free of host imports like `lib/fold.js`:
   - `classify(events)` or equivalent: return `{ nerd, studyPlus }` from decoded log events. Nerd Mode follows the spec's rule exactly, including the `command/run` + successful `command/done` pairing and the bare/`off` argument rule. Study-plus counts on each of the four signals and on nothing else. A prose mention of `study-plus` does not count.
   - Index read, scan, merge, and write. Key by session id; store the log file's `mtimeMs` and `size` and the two flags. A file whose `mtimeMs` and `size` match is not decoded. A changed file replaces `studyPlus` and merges `nerd` with `||`. Prune ids whose session file is gone. Write atomically (temp file + rename). Default path `~/.dsh/study-sessions-index.json`, overridable by an argument so tests use a temp folder.
   - Chunked scan: enumerate `~/.dsh/sessions/*/*/session.v4.jsonl.zstd` sorted by path, process at most 20 files per call starting at `cursor`, return `{ phase, done, total, sessions }`, with `phase: 'ready'` when the last chunk is done. `sessions` is `{ [id]: { studyPlus: boolean } }`, and an id's presence means Nerd Mode was on at least once. No file is decoded twice in one run.
2. `lib/index.js`: register `GET /dsh-nerd-mode/api/study-sessions` inside `ctx.inject(['webServer', 'connection'], ...)` and `ctx.effect`, so the route disposes with the plugin and a host without the services still loads the switch and the prompt section. Reject non-GET with 405. Call `ctx.connection.requestRejection(req)` first and reply 403 on a rejection. Reply `content-type: application/json; charset=utf-8` and `cache-control: no-store`. On a read failure reply 500 with `{ error }`.
3. `test/study-sessions.test.mjs`:
   - fixtures, not mocks: write real `session.v4.jsonl.zstd` files, one zstd frame per batch (`zstdCompressSync`), in a temp folder. Assert: a bare `/nerd-mode` counts; `/nerd-mode off` alone does not; a failed command does not; a prose mention of study-plus does not make In-depth; each of the four study-plus signals does.
   - the merge rule: a file that loses the Nerd Mode event still reports `nerd`; a changed `studyPlus` flag is replaced.
   - chunk resume: 45 files, chunk size 20, three calls, and no file decoded twice.
   - the route: 405 for POST; 403 when `requestRejection` returns 403; 200 JSON with `no-store` on success. Use a fake `req`/`res`, no network.
4. Keep `test/settings.test.mjs` green: its fake `ctx.inject` calls every callback, so guard the route registration or extend the fake. Do not weaken the existing assertions.

Out of scope: the client panel, the index's UI copy, and Course files.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- No new dependency.
- The route path, method, headers, and reply shape match the spec.

## Validation owner

The implementer runs `npm test` and `npm run lint`. The merger reads the route handler and the index merge rule against the spec. Ticket 03 consumes the reply shape.
