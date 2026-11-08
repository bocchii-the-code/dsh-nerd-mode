# 01 — Verify the host surfaces the panel uses

Status: resolved
Blocked by: none

## Question

Which exact host surfaces do the Study Sessions panel and its route register into, and what are their shapes? Confirm each one against the installed host, not memory.

## Scope

Read `.scratch/study-sessions-panel/spec.md`, sections **Implementation Decisions** and **Further Notes**.

Host under test: DeepSeek Harness with packages `@deepseek-ai/dsh-*` 0.2.1-rc.5. Sources:

- `D:\DSH\resources\app.asar`, under `dsh/node_modules/@deepseek-ai/<package>`. A read-only extract of the packages listed below already exists at `C:\Users\zhang\AppData\Local\Temp\opencode\dsh-asar-host\`; extract another package from the asar only when the answer needs it.
- The Context Insights seat: `C:\Users\zhang\.dsh\profiles\desktop\node_modules\dsh-context\lib\client.js` (version 0.81.0).

Answer these, each with a file path and line number:

1. `sidebar.panellist`: the registration options (`id`, `order`, `label`, `locale`) and the props the icon component receives. Which order does Context Insights use? Does an entry with order 30 sort between Context Insights and More?
2. `main`: the registration shape for a keyed page (`key`). Which props does the page body receive, and where do `useSessions` and `locale` come from? What does `ctx.layout.selectPanel(id)` do when the key is registered and when it is not?
3. The `useSessions` snapshot: exact fields (`ids`, `byId`, `phase`), the row fields `displayTitle`, `updatedAt`, `cwd`, `blank`, `projectionValues`, and the title fallback chain. What is `phase` while the list loads?
4. `uiWorkspace.openSession(id)`: the service name, the exact call, and what the caller sees. Is the service reachable with `ctx.get('uiWorkspace')` when the plugin does not declare it in `inject`?
5. `webServer.register`: the route shape (`kind: 'exact'`, `path`, `handler(req, res)`), the disposer, and whether `ctx.webServer` can be awaited with `ctx.inject([...])` so a host without it still loads the plugin. Confirm `ctx.connection.requestRejection(req)` exists, its return values, and the reply the route should send for a rejection.
6. The same-origin client call: which fetch options carry the browser auth cookie, and what does the host reply when the route is not registered?
7. Session logs: confirm `~/.dsh/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd` for the sessions on this machine (201 files). Decode a real file with the frame-splitting recipe in `docs/agents/dsh-session-api.md` and state whether the first frame is the `session` header. Confirm `node:zlib` `zstdDecompressSync` works on this Node (22.21.1).
8. Any surface in the spec's **Implementation Decisions** whose name or shape is wrong. State the correction in one line.

Write the findings to `.scratch/study-sessions-panel/host-api.md`, one `###` section per item, each with the evidence path, line number, and a short code shape. Add a final `### Corrections to the spec` section. Do not change any other file.

## Fallback

If a surface does not exist in the installed host, say so and name the smallest alternative that still meets the spec. Do not implement the alternative here.

## Acceptance

- `host-api.md` answers items 1-8 with evidence.
- No file other than `host-api.md` changes.
- `npm test` still passes (no code changes expected).

## Validation owner

The orchestrator reads `host-api.md`. Tickets 02 and 03 quote it.

## Answer

All eight items are verified. Evidence and line numbers are in `.scratch/study-sessions-panel/host-api.md`.

The load-bearing corrections:

- Both slot registrations also need `name`, and the `label` closure must own its translator.
- `useSessions` adds `projectionsBySession`; `cwd` and `projectionValues` are optional on a row.
- `requestRejection` returns `401` or `403`, so the route replies with the returned code.
- The optional `webServer` is a `ctx.inject` fork, not a top-level `inject` entry.
- An unregistered route answers `404` with an empty body, so the client treats `404`, `405`, empty, and non-JSON replies as a missing route.
- The `main` `locale` option is a namespace name and needs `ctx.locale.register`, so ticket 03 injects the `locale` service and keeps the existing `useT` helper.

