# Spec: Study Sessions panel

Status: draft

## Problem Statement

Nerd Mode is a per-conversation switch. Outside a conversation, nothing shows which conversations have it, and nothing separates a conversation that ran a full study-plus Course from one that answered a single question. This machine holds 201 sessions across 10 workspaces, 41 of them with Nerd Mode switched on at some point. The only global list is the workspace sidebar, which marks neither the switch nor the lane. To find last week's Course session the learner opens conversations until the right one appears.

## Solution

Add a global panel named Study Sessions to the left sidebar, after Context Insights. It lists every conversation where Nerd Mode was switched on at least once, in three groups: Quick, In-depth, and a collapsed Past group. A row shows the session title, its workspace, and when it last changed. A click opens that conversation. The panel reads no Course files and shows no learner progress. It answers one question: which conversations are my study conversations.

## User Stories

1. As a learner, I want a Study Sessions item in the left sidebar, so that I can find my study conversations without opening them.
2. As a learner, I want the item placed after Context Insights, so the existing menu order does not move.
3. As a learner, I want conversations from every workspace in one list, so I do not have to remember which workspace a lesson happened in.
4. As a learner, I want a Quick group for conversations that only asked a question, so I can tell them from a Course run.
5. As a learner, I want an In-depth group for conversations that ran `/study-plus` at least once, so returning to a Course costs one click.
6. As a learner, I want a Past group for conversations where I switched Nerd Mode off again, so old work stays reachable without crowding the list.
7. As a learner, I want each Past row to keep a Quick or In-depth chip, so switching the switch off does not erase what the conversation was.
8. As a learner, I want each group heading to carry a count, so I can see the shape of my work before reading rows.
9. As a learner, I want rows ordered by the most recent change, so the conversation I just left sits on top.
10. As a learner, I want each row to name its workspace, so two sessions with the same title stay apart.
11. As a learner, I want a click to open the conversation, so the jump costs one action.
12. As a learner with no study conversation yet, I want one line telling me how to switch Nerd Mode on, so the panel is not a dead end.
13. As a learner opening the panel for the first time, I want the scan to run in the background, so the app keeps responding.
14. As a learner, I want later opens to read only the sessions that changed, so the panel opens at once.
15. As a learner whose index cannot be read, I want one line naming the failure, so I can tell a permissions problem from an empty list.
16. As a learner using a screen reader, I want the group headings and the row buttons announced with their names and counts.
17. As a learner, I want the panel to keep the last good list when a rescan fails, so one unreadable session does not blank the page.

## Implementation Decisions

**Seat.** Register two slot entries with the same id, the pattern Plugins, Automation tasks, and Context Insights use. `sidebar.panellist` takes `id: 'study-sessions'`, `order: 30`, and a `label` function, and renders the sidebar icon. `main` takes `key: 'study-sessions'`, `locale`, and `inject`, and renders the page. `ctx.layout.selectPanel(id)` swaps the main area, so no route and no modal is needed. Order 30 puts the row after the shipped entries (plugins 0, schedule 10, context 20) and before More.

**Client data.** The `sessions` service is already published as a root hook. Inside the panel component, `useSessions((state) => state)` returns `{ ids, byId, phase }`, and each row carries `id`, `displayTitle`, `updatedAt`, `cwd`, `blank`, and `projectionValues`. `projectionValues.studyMode.active` is the live switch state and needs no new work. Titles and times come from this list, never from the index, so a missing title keeps the host's fallback chain.

**History data.** The list knows the current state only. A host route returns the history: `GET /dsh-nerd-mode/api/study-sessions` replies `{ phase, done, total, sessions: { [id]: { studyPlus: boolean } } }`. Presence of an id means Nerd Mode was switched on at least once.

**Index.** The route reads `~/.dsh/study-sessions-index.json`, keyed by session id and by the log file's mtime and size. A file whose mtime and size match the index is not decoded. A changed file is decoded and its flags replace the stored ones, with one exception: the `nerd` flag is merged with `||`, because compaction can drop the original event, and a fact that disappeared from a rewritten log must not resurface as a missing session.

**Scan.** Sessions live at `~/.dsh/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd`. The file is a chain of zstd frames, so the scan splits on the magic bytes and decodes each frame, as `docs/agents/dsh-session-api.md` describes. The scan is chunked: the route accepts `?cursor=<index>` and decodes at most 20 files per call, then replies with the next cursor. The panel calls the route until `phase` is `ready`. A cold scan of this machine's 201 files and 90 MB takes 6.3 s, spread over 11 calls.

**Classifying Nerd Mode.** A session counts when the log holds a `command/run` event with `data.name === 'nerd-mode'` and `data.args` that is absent or not `off`, paired by `commandId` with a `command/done` of kind `success`. This is the same rule `lib/fold.js` applies, so the index and the live projection cannot disagree about what counts as switching on.

**Classifying In-depth.** A session counts as In-depth when at least one completed `/study-plus` invocation appears: a message with `source.kind === 'skill-invocation'` and `source.name === 'study-plus'`, a user message whose text holds `/study-plus` as a standalone command, a `tool/call` named `skill` whose arguments name `study-plus` and which has a successful `tool/result` with the same `callId`, or a `tool/ptc-dispatch` named `skill` with `arguments.name === 'study-plus'` and `isError !== true`. Prose that mentions study-plus must not count. On this machine a substring match finds 73 sessions, these rules find 25, and only 16 of the 41 Nerd Mode sessions qualify.

**Grouping.** `active && studyPlus` goes to In-depth, `active && !studyPlus` goes to Quick, and `!active` goes to Past. The Past group is collapsed by default and keeps a chip on each row. A row with no live projection value counts as `active: false`.

**Row.** A button with three parts: title, workspace name from `basename(cwd)`, and a relative time from `updatedAt`. The whole row is one click target. `uiWorkspace.openSession(id)` runs on click, and the main area then shows the conversation, so the panel needs no close call.

**Refresh.** The panel fetches once when it mounts. The shell unmounts a panel when another one is selected, so returning to Study Sessions reads again. No timer, no watcher, no refresh control.

**Empty and failure states.**

| Situation | What the panel shows |
|---|---|
| No session ever had Nerd Mode | One line: turn Nerd Mode on from the composer bar, or run `/nerd-mode on` |
| A group has no rows | The group is not rendered |
| First scan running, no cached rows | A loading line with `done` of `total` |
| First scan running, cached rows present | The cached rows, plus the same loading line |
| Route failed, cached rows present | The rows, plus one line naming the failure |
| Route failed, no cached rows | One line naming the failure |
| A stored session no longer exists | No row, because rows come from the session list |

**Copy.** Both languages, through the existing `t({ en, zh })` helper.

| Key | English | Chinese |
|---|---|---|
| Sidebar item and page title | Study Sessions | 学习会话 |
| Quick heading | Quick | 快速 |
| In-depth heading | In-depth | 深入 |
| Past heading | Past | 过去 |
| Empty line | No study session yet. Turn on Nerd Mode from the composer bar, or run `/nerd-mode on`. | 还没有学习会话。在输入栏打开 Nerd Mode，或运行 `/nerd-mode on`。 |
| Scanning line | Scanning session history… 40 of 201 | 正在扫描会话历史… 40 / 201 |
| Failure line | The session index could not be read: {reason} | 无法读取会话索引：{reason} |

**Layout.** One column, maximum width 720 pixels, matching the Settings section. A heading row, then the three groups. Group headings sit above their rows and carry the count as text, not as a badge. Rows are full-width buttons with a 1-pixel separator. The Past heading is an expand control. Theme alias variables only, no new colours.

**Accessibility.** The page body is a region with an accessible name from the title. Group headings are level-two headings whose text includes the count. Rows are buttons, so Enter and Space work. The Past heading is a button with `aria-expanded`. The loading line is a status region, and the failure line is an alert. Focus order follows the visual order.

**Host route.** Register in `apply` through `ctx.inject(['webServer'], …)` and `ctx.webServer.register({ kind: 'exact', path, handler })` inside `ctx.effect`, so the route disposes with the plugin. The handler calls `ctx.connection.requestRejection(req)` first, because `webServer.register` adds no auth fence, and replies 403 on rejection. Only GET is allowed. The reply sets `content-type: application/json; charset=utf-8` and `cache-control: no-store`. The client fetches the same origin, so the auth cookie travels without extra options.

**Manifest.** The client package already injects `@deepseek-ai/dsh-client-ui-conversation`. The `main` slot belongs to the layout package and `sidebar.panellist` to the sidebar package, both loaded by the shell. The host module gains `webServer` as an optional inject, so a host without it still loads the switch and the prompt section, and the panel shows the failure line.

## Testing Decisions

The classifier is the part that can silently be wrong, so it gets fixtures, not mocks. Write small `session.v4.jsonl.zstd` files with one frame per batch, then assert the flags: a bare `/nerd-mode` counts; `/nerd-mode off` alone does not; a failed command does not; a prose mention of study-plus does not make In-depth; each of the four study-plus signals does.

The chunked route gets one resume test: 45 files, chunk size 20, three calls, and no file decoded twice.

The index gets one test for the merge rule: a file that loses the Nerd Mode event still reports nerd, and a changed `studyPlus` flag is replaced.

The panel gets one render test through the existing fake-context harness: a fake session list with four rows, a fake index, and assertions on the group headings, the counts, the Past chip, the empty line, and the row's accessible name.

No test asserts internal helper names or a whole-tree snapshot. One behaviour per test, named after what the learner sees.

## Out of Scope

- Creating, renaming, archiving, or deleting a session from the panel.
- Showing Course progress, the Tracker, or the lecture library.
- Filtering by workspace, by date, or by text.
- Live updates while the panel stays open.
- A refresh control.
- Marking a session as Quick or In-depth by hand.
- Sessions that never had Nerd Mode.
- A mobile layout.

## Further Notes

- The host publishes no API reference. The slot names, the `sessions` row shape, and `uiWorkspace.openSession` come from the shipped bundles of `@deepseek-ai/dsh-*` 0.2.1-rc.5 at `D:\DSH\resources\app.asar`. A host upgrade can move them, so the panel must tolerate a missing hook and a missing service.
- Two sources now describe Nerd Mode history: the live projection and this index. A log rewrite can make them disagree. The index keeps the `nerd` flag on purpose, and it lets the `studyPlus` flag follow the log.
- The index holds one small record per session. It must prune ids whose folder is gone, or the panel lists rows that cannot be opened.
- The route touches the file system outside the workspace. That is a new permission for this plugin, and it is why the route is read-only and rejects anything but GET.
- A cold scan blocks nothing, but it does read 90 MB. On a machine with several hundred large sessions the first open is slower, and the chunk size is the knob.
- The sidebar icon needs an inline SVG, because the client bundle cannot read `assets/`.
- The panel answers "where did I study", not "how far am I". The Study tab already answers the second question, and the two must not be merged.
