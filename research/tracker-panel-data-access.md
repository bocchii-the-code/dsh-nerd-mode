# Tracker panel data access: facts from the installed dsh packages

Source root for every `DSH/...` citation below:

`C:\Users\zhang\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\`

Nothing in this note is a decision. Facts are cited. Claimed inferences are marked INFERENCE. Facts I could not establish are listed at the end.

## 1. `ctx.remote.workspaceFiles`: signatures, return shapes, path form

The generated client namespace declares five methods. Every one names a Session on the wire, never a workspace root (`DSH/dsh-api-workspace-files/lib/typert.remote-client.d.ts:13-19`):

| Method | Signature | Returns |
|---|---|---|
| `stat` | `(workspaceFileScopeId: SessionId, path: string, signal?: AbortSignal)` | `Promise<RemoteResult<WorkspaceFileStat>>` |
| `read` | `(workspaceFileScopeId: SessionId, path: string, range: WorkspaceFileRange, signal?: AbortSignal)` | `Promise<RemoteResult<WorkspaceFileText>>` |
| `readBytes` | `(workspaceFileScopeId: SessionId, path: string, options: WorkspaceByteReadOptions, signal?: AbortSignal)` | `Promise<RemoteResult<RemoteDecoded<WorkspaceFileBytes>>>` |
| `list` | `(workspaceFileScopeId: SessionId, path: string, signal?: AbortSignal)` | `Promise<RemoteResult<WorkspaceDirectoryListing>>` |
| `changes` | `(workspaceFileScopeId: SessionId, path: string, signal?: AbortSignal)` | `RemoteStreamHandle<WorkspaceFileWatchFrame, never>` |

The same five rows are documented as a table at `DSH/dsh-api-workspace-files/README.md:30-36`.

Return shapes:

- `WorkspaceFileStat`: `{ absolutePath, version, bytes? }`. `absolutePath` is absolute in the filesystem's execution world and symlink-resolved. `version` is an opaque freshness token. `bytes` is the complete file size and is optional (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:17-30`).
- `WorkspaceFileText` (what `read` gives for a text file): stat plus `offset` (first line of the page), `text` (page lines joined by `\n`, no trailing newline), `lines` (count of lines on the page, `0` past the end), `eof` (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:42-55`). Lines are 1-based and end at `\n`. A final `\n` terminates the last line and does not start an empty one (`DSH/dsh-api-workspace-files/README.md:44`).
- `WorkspaceDirectoryListing`: `{ path, entries, truncated }`, where `path` is the listed directory as a workspace-relative path (empty for the root) and `entries` are direct children `{ name, type: 'file' | 'directory' | 'other', size? }` (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:83-110`).
- `WorkspaceFileWatchFrame`: `{ kind: 'ready' }` then `{ kind: 'change', change }`, where `change` is `{ absolutePath, version }` or `{ absolutePath, absent: true }` (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:117-138`).

Path form:

- `read`, `readBytes`, `stat`, and `changes` accept an absolute path or a path relative to the named Session's workspace root. The composed filesystem decides readability, and file reads are not workspace-confined (`DSH/dsh-api-workspace-files/README.md:40`).
- `list` speaks workspace paths, absolute or relative to the workspace root, and the returned `path` is relative to that root. The directory must resolve inside the workspace (`DSH/dsh-api-workspace-files/lib/index.js:488-514`).
- The module header states both vocabularies explicitly: file methods name an absolute path because their consumer is the Client resource address; `list` speaks workspace paths because its consumer is a tree rooted at the workspace root (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:5-12`).
- No method accepts a `dsh-resource://` URI. URIs belong to the client resource layer, which parses them and calls the Session-scoped methods (`DSH/dsh-api-workspace-files/lib/client.js:312-343`, `416-433`).

`read` requires the `range` argument positionally, but both fields are optional, so `{}` is the documented way to ask for the default page (`DSH/dsh-api-workspace-files/lib/types/types.d.ts:35-40`). Defaults and caps: `maxLines` 5000, `maxBytes` 2097152, `maxFileBytes` 33554432, `maxEntries` 2000 (`DSH/dsh-api-workspace-files/README.md:62-67`).

## 2. How a root-scope slot learns the workspace root, and several workspaces

There is no workspace-root argument anywhere in the namespace. The root is derived on the Host from the Session named on the wire: live Session header `cwd`, else the persistence header, else `ctx.sandboxPolicy.workspaceRoot` (`DSH/dsh-api-workspace-files/lib/index.js:398-416`, especially line 412). A Session that cannot resolve makes the Gateway return `gateway/lookup-not-found` (`DSH/dsh-api-workspace-files/README.md:28`).

A root-scope slot can learn workspace directories, but not through `workspaceFiles`:

- The root scope receives `useWorkspaces`, a selector hook over the Workspace Controller snapshot (`DSH/dsh-client-ui-workspace/lib/types/client/index.d.ts:9-15`).
- Snapshot rows are `WorkspaceView`: `{ workspaceId, path, title, sessionIds, createdAt, updatedAt }`, where `path` is the canonical host directory (`DSH/dsh-api-workspace-controller/lib/types/types.d.ts:13-25`) and the snapshot carries `items`, archive set, and pin set (`DSH/dsh-api-workspace-controller/lib/types/client/model.d.ts:9-18`).
- The root scope also receives `useSessions` over `SessionListState`, whose rows carry `cwd?: string` (`DSH/dsh-api-session-controller/lib/types/client/sessions/service.d.ts:17-24`, `46-55`). The shipped file tree takes its root exactly this way: `useSessions().byId[sessionId].cwd` (`DSH/dsh-client-ui-sidebar-files/README.md:38`).

With several workspaces open:

- The workspace snapshot holds one row per registered workspace, each with its own `path` and `sessionIds` (`DSH/dsh-api-workspace-controller/lib/types/types.d.ts:19-25`). There is no single "current workspace root" value in the snapshot.
- Every `workspaceFiles` call resolves against the Session it names (`DSH/dsh-api-workspace-files/lib/index.js:412`), so two calls with two Sessions can resolve two different roots in one client.
- A workspace that has no Session has no root the namespace can use. The client `file` provider fails an `absolute/` address with `workspace-file/unknown-workspace` and never borrows a current or tab Session (`DSH/dsh-api-workspace-files/lib/client.js:416-433`, `447-449`; `DSH/dsh-api-workspace-files/README.md:79`).
- INFERENCE: a root-scope panel that holds only a workspace `path` and no Session id cannot call `list` on that path, because the required first argument is a `SessionId`.

## 3. Error shapes: missing file, missing directory, permission failure

Delivery form:

- Unary methods resolve to `RemoteResult<T>`: `{ ok: true, value }` or `{ ok: false, error: RemoteFailure }`. The Remote face folds carrier failures into the error branch, so consumers do not wrap calls to recover them (`DSH/dsh-typert-protocol/lib/types/types.d.ts:103-116`).
- `RemoteFailure` is a `RemoteError` instance carrying a stable `code` and typed `details`. Discrimination is by `code`, never by `instanceof` (`DSH/dsh-typert-protocol/lib/types/remote-error.d.ts:3-22`).
- Stream errors throw on iteration instead. A handle stands for one generation, and iteration fails with the carrier error when the carrier is lost (`DSH/dsh-typert-protocol/lib/types/types.d.ts:132-143`).

Cases:

| Case | Result |
|---|---|
| Missing file with `read` or `stat` | `workspace-file/not-found`, `details: { path }`, thrown from `inspect` when `lstat` finds nothing (`DSH/dsh-api-workspace-files/lib/index.js:563-568`), and again after resolution when `stat` finds nothing (`DSH/dsh-api-workspace-files/lib/index.js:599-600`) |
| Missing directory with `list` | `workspace-file/not-found` with the same details. `list` calls the same `inspect` first, so a missing path fails before any directory check (`DSH/dsh-api-workspace-files/lib/index.js:495-496`) |
| Path is a file, `list` expected a directory | `workspace-file/not-directory`, `details: { path, kind }` (`DSH/dsh-api-workspace-files/lib/index.js:497-506`) |
| Path is a directory, `read` or `stat` expected a regular file | `workspace-file/not-regular-file`, `details: { path, kind }`. `stat` is not a way to test for a directory (`DSH/dsh-api-workspace-files/lib/index.js:484-487`, `589-604`) |
| Directory outside the workspace with `list` or `changes` | `workspace-file/outside-workspace`, `details: { path }` (`DSH/dsh-api-workspace-files/lib/index.js:576-583`, `69`) |
| Non-UTF-8 or NUL-containing page | `workspace-file/not-text`, `details: { path }` (`DSH/dsh-api-workspace-files/lib/index.js:430`, `618-625`) |
| Page or window above the cap | `workspace-file/too-large`, `details: { path, limit }` (`DSH/dsh-api-workspace-files/lib/index.js:550-553`, `464-467`) |
| Empty path, bad offset, bad limit, relative path under `baseFile` | `gateway/bad-request` (`DSH/dsh-api-workspace-files/lib/index.js:564`, `529`, `536-543`) |
| Watch could not start | `workspace-file/watch-unsupported`, `details: { path }` (`DSH/dsh-api-workspace-files/lib/index.js:80-84`) |

The full declared code list is `DSH/dsh-api-workspace-files/lib/types/types.d.ts:140-172`.

Permission failure:

- No permission code is declared for this namespace. The only backend codes it classifies are `FS_NOT_TEXT` (`DSH/dsh-api-workspace-files/lib/index.js:633-635`) and `FS_TOO_LARGE` (`DSH/dsh-api-workspace-files/lib/index.js:463-469`). Every other backend error is rethrown unchanged (`DSH/dsh-api-workspace-files/lib/index.js:621-623`).
- The Connection adapter answers `gateway/internal` with empty details for unclassified exceptions. A `RemoteError` crosses the wire with its own code (`DSH/dsh-api-gateway/README.md:87`), and the client rebuilds such an exception as `gateway/internal` plus the original message (`DSH/dsh-api-gateway/lib/client.browser.js:1148`, `DSH/dsh-typert-protocol/lib/types/remote-error.d.ts:3-8`).
- INFERENCE: an `EACCES` or `EPERM` from the filesystem backend therefore arrives as `{ ok: false, error: RemoteError('gateway/internal', <backend message>, {}) }`. Its `cause` chain survives only in-process (`DSH/dsh-api-gateway/README.md:87`).
- I found no file that maps a permission failure to `workspace-file/not-found` or to any dedicated code.

## 4. `changes` as a push subscription, and its cost while idle

Usable from a root-scope slot:

- `changes` is a `stream` Remote, not a callback. Its client value is a `RemoteStreamHandle`, "the downlink items as an `AsyncIterable`" (`DSH/dsh-api-workspace-files/lib/typert.remote-client.d.ts:14`; `DSH/dsh-typert-protocol/lib/types/types.d.ts:132-143`).
- The only inputs are `sessionId`, `path`, and an optional `AbortSignal`, so the call shape does not depend on slot scope (`DSH/dsh-api-workspace-files/lib/typert.remote-client.d.ts:14`).
- `remote` is a client-root service. The shipped workspace-files browser plugin injects `resources`, `remote`, and `remote.workspaceFiles` at the client root and calls `remote.$stream(...)` there (`DSH/dsh-api-workspace-files/lib/client.js:451-471`, `104-113`). A registration's `inject` face may close over the plugin's declared Cordis services (`DSH/dsh-client-ui-workspace/README.md:171`), which is how the current plugin in this repo passes `ctx.remote.commands.execute` into its component (`client.js:577-579`).
- What the stream does: the Host resolves the target, starts `fs.watch` on it, yields `{ kind: 'ready' }`, then yields `change` frames. Missing files stay watchable for same-path recreation while the parent directory remains. Local providers use Chokidar, and directories watch direct entries only (`DSH/dsh-api-workspace-files/README.md:58`; `DSH/dsh-api-workspace-files/lib/index.js:72-103`).
- The local filesystem backend watches "through OS events, without polling or recursive watching" (`DSH/dsh-fs-local/README.md:57`).

Cost while idle:

- One Host watcher per open generation of a target. "A holder that neither iterates nor disposes the handle keeps the Host stream alive" (`DSH/dsh-typert-protocol/lib/types/types.d.ts:136-139`). With a live watcher and no events, the frame loop is idle (`DSH/dsh-api-workspace-files/lib/index.js:88-103`).
- Client-side sharing: one supervised stream serves each `(sessionId, path)` pair, and consumers of that target share it. The last follower leaving disposes the stream, and a successor waits for that disposal (`DSH/dsh-api-workspace-files/README.md:83`; `DSH/dsh-api-workspace-files/lib/client.js:89-167`, `197-263`).
- A stalled consumer grows Host memory for the life of the stream, because a generation buffers observations until its consumer pulls them (`DSH/dsh-api-workspace-files/README.md:146`; `DSH/dsh-api-workspace-files/lib/index.js:110-158`).
- No shipped file states a measured idle cost (file descriptors, CPU, or bytes) for one watcher. That number is not established here.

## 5. `useProjection`, `sessionProjections`, and the root-scope data surface

`useProjection` is session-scope only:

- The client declares two prop sets. `GlobalStandardProps` carries `useSessions`, `useSessionStatus`, `useSessionRetainInfo`, `useSessionAccess`. `SessionStandardProps` and `SessionMaybeStandardProps` carry `useProjection` (`DSH/dsh-client-ui-session/lib/types/client/index.d.ts:72-99`).
- The same file describes the adapter as the "renderer-facing adapter for `session` and `session-maybe` scopes" (`DSH/dsh-client-ui-session/lib/types/client/index.d.ts:150-151`).
- Root-scope slots are the ones declared with `scope: 'root'`, for example the keyed `main` panel and `shell.bottom` (`DSH/dsh-client-ui-layout/lib/types/client/index.d.ts:49-56`, `75-84`). The `main` panel's own props are typed as `PropsRuntime<'main'>`, and shipped consumers pick only global hooks from it, for example `useSessions` and `useWorkspaces` (`DSH/dsh-client-ui-schedule/lib/types/client/TaskDetail.d.ts:42`).

`sessionProjections` is a Host registry keyed by session:

- Units are registered on the Host, and carriers read `snapshot(session)` and `stateOf(session, key)`, both taking a session (`DSH/dsh-session-projection/README.md:58-65`).

Projection values are still reachable from root scope by Session id, two ways:

- `ctx.remote.session.projections(request)` is a generated unary Remote taking `{ sessionId }` and resolving to a sequenced baseline or migration hints (`DSH/dsh-api-session-controller/lib/typert.remote-client.d.ts:29`; `DSH/dsh-api-session-controller/lib/types/types.d.ts:413-423`).
- The `useSessions` snapshot itself carries `projectionsBySession` with values and per-session state, "including unopened Sessions" (`DSH/dsh-api-session-controller/lib/types/client/sessions/service.d.ts:46-55`; `DSH/dsh-api-session-controller/lib/types/client/sessions/manager.d.ts:33-40`).

Root-scope data surface that exists:

| Surface | What it gives | Citation |
|---|---|---|
| `ctx.remote` (any namespace) | Unary and stream Remotes; the namespace list is generated per package | `DSH/dsh-api-workspace-files/lib/client.js:451-457` |
| `ctx.resources` plus `useResource<'file'>(address)` | File metadata for a `dsh-resource://file/session/<id>/<path>` address. "Any UI, including Global components, shares the observation for the same complete address." | `DSH/dsh-api-workspace-files/README.md:75-83` |
| `useWorkspaces` | Workspace rows with canonical `path` and `sessionIds` | `DSH/dsh-client-ui-workspace/lib/types/client/index.d.ts:10-15` |
| `useSessions` | Session rows with `cwd`, plus `projectionsBySession` | `DSH/dsh-api-session-controller/lib/types/client/sessions/service.d.ts:17-55` |
| `useSessionAccess`, `useWorkspaceAccess` | Whether the Peer may call an action on a resource | `DSH/dsh-client-ui-session/lib/types/client/index.d.ts:77-78`; `DSH/dsh-client-ui-workspace/lib/types/client/index.d.ts:13-14` |

Host-side parsing:

- `workspaceFiles` returns raw text pages and raw directory listings. It exposes no parse, no projection, and no mutation (`DSH/dsh-api-workspace-files/README.md:12`, `30-36`; `DSH/dsh-api-workspace-files/lib/types/types.d.ts:16-111`).
- Parsing of document content in the shipped client happens after the text arrives, in the document preview bodies that receive `content` (`DSH/dsh-client-ui-sidebar-documentpreview/README.md:35`).
- INFERENCE: a panel that needs Host-side parsing of `state.md`, `graph.md`, or `log.md` would need a Host service or Remote that does not exist in this install. The only Host-side read surfaces I found are `workspaceFiles` (raw text and listings) and the session projections, which fold registered Session events and not workspace files (`DSH/dsh-session-projection/README.md:58-65`).

## What this means for the panel

Every read of `study/<slug>/state.md`, `graph.md`, or `log.md` goes through `ctx.remote.workspaceFiles` and must name a Session, because the Session header supplies the workspace root and no method takes a root. A root-scope panel can obtain workspace directories from `useWorkspaces`, Session `cwd` and per-session projection values from `useSessions`, and file metadata through `useResource('file')` with a session-scoped address. It cannot call `useProjection`, which exists only on session-scope props. `list` on a missing directory returns `workspace-file/not-found`, `stat` and `read` refuse a directory with `workspace-file/not-regular-file`, and an unclassified backend failure such as a permission denial arrives as `gateway/internal`. `changes` is an `AsyncIterable` per `(sessionId, path)` target that starts a Host watcher before its `ready` frame, shares one watcher across consumers of the same target, and is disposed by its last consumer.

## Facts not established

- No shipped file states a measured idle cost for one open `changes` target (file descriptors, CPU share, or memory).
- No shipped file maps a filesystem permission failure (`EACCES`, `EPERM`) to a dedicated `workspace-file/*` code.
- No `dsh-client-ui-slots` package is present in this install, so `SlotScopeTargetMap` internals and the full `PropsRuntime` derivation were read only through packages that extend it (`DSH/dsh-client-ui-session/lib/types/client/index.d.ts:68-100`).
- I did not find any Endpoint or projection that parses tracker markdown into structured values.