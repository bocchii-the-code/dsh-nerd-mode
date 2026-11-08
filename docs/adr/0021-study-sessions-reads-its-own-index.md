# Study Sessions reads its own index, not the projection

Status: accepted

The Study Sessions panel needs history: whether a conversation ever had Nerd Mode on, and whether it ever ran `/study-plus`. The `studyMode` projection holds the current switch only. Adding history bits to it looked simpler, but the host serves an unopened session from a persisted snapshot, and a `stateVersion` bump throws that snapshot away. Rows for sessions that have not been opened since the upgrade would read blank, so the list would be wrong in a way the learner cannot see. The panel therefore builds its own index from the session logs, stores it in `~/.dsh/study-sessions-index.json`, keys it by file mtime and size, and serves it through one read-only host route. A cold scan of 201 sessions takes 6.3 s and runs in chunks. Later opens decode only changed files. The cost is a new file outside the workspace and a second source of truth for history.

## Considered Options

- **Extend the `studyMode` projection and bump `stateVersion`.** No new file, no route, and durable by design. Rejected because unopened sessions are read from a cached snapshot, and a version mismatch drops that snapshot. The list would silently lose every session that has not been opened since the upgrade.
- **Client only, from `projectionValues.studyMode.active`.** About ten lines and no host work. Rejected because it answers the current state only, so there is no Past group and no way to tell In-depth from Quick.
- **Read the host's projection cache directly.** It already holds every wire value per session. Rejected because it is an internal store, version 7, layout per record, with no stability promise.

## Consequences

- The plugin reads files outside the workspace for the first time. The route is read-only, GET only, and calls `ctx.connection.requestRejection` before it replies.
- The first open after install costs one cold scan. It is chunked, so the app stays responsive, and the panel shows progress.
- History now has two sources. A log rewrite can make them disagree. The index keeps the `nerd` flag, and it lets `studyPlus` follow the log.
- The index must prune sessions whose folder is gone, or the panel lists rows the session list cannot open.
- A host upgrade that moves the slot names or the `sessions` row shape breaks the panel without touching the switch, so the panel fails soft and Nerd Mode keeps working.
