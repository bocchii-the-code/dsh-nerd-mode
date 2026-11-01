# DSH Session API Used by This Plugin

The host publishes no separate API reference. These facts come from the host
type declarations and implementation in `D:\DSH\resources\app.asar`.

- `session.seq` is the current session log offset.
- `session.eventAt(seq)` returns the durable event at that offset.
- `session.deriveMessages()` returns a fresh array of the full surface history
  for the next model request. It is not limited to the current turn. A compact
  checkpoint can reset it.
- `session.surface.nodes` lists the visible event offsets.
- `agent/inbox/claimed` fires for each claimed message, with `{ agent, message }`.
- `ctx.sessionProjections.stateOf(session, key)` reads the per-session
  projection state.
- `ctx.systemPrompt.section({ name, order, text })` registers a prompt section.
  The host calls `text(context)` on each prompt build.

Event payload shapes differ by type. Read the real log before trusting a shape.

- `user/message` stores the message directly in `event.data`: `content`,
  `source`, `role`, `id`. There is no `event.data.message`.
- `tool/result`, `system/message`, `assistant/message`, and `developer/message`
  wrap the message as `event.data.message`.
- `tool/call` stores `callId`, `name`, and `arguments` (a JSON string) directly
  in `event.data`.
- `tool/ptc-dispatch` stores a sub-tool result with `name`, `arguments` (an
  object, not a string), `isError`, and `content`. It has no `message`. A
  `skill` call made inside `run_code` appears here, not as a `tool/call`.

A resumed, forked, or externally written seed can carry a partial payload.
Guard nested reads instead of failing the turn.

Message sources include `user`, `skill-invocation`, `tool`, and
`agent-instructions`.

Use `deriveMessages()` to find an earlier skill invocation. Use `eventAt` and
`seq` only for the current turn, and stop at `turn/start`.

## Read the session log file

A session lives at `~/.dsh/sessions/<workspace-slug>/<session-id>/session.v4.jsonl.zstd`.
The file is a chain of independent zstd frames, one per append batch.
`zstdDecompressSync` on the whole file stops after the first frame, which holds
only the `session` header. Decode frame by frame.

```js
import fs from 'node:fs'
import z from 'node:zlib'

// path = '.../<session-id>/session.v4.jsonl.zstd'
const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
const bytes = fs.readFileSync(path)
const starts = []
for (let i = 0; i <= bytes.length - 4; i += 1) {
  if (MAGIC.every((byte, k) => bytes[i + k] === byte)) starts.push(i)
}
let text = ''
for (let i = 0; i < starts.length; i += 1) {
  text += z.zstdDecompressSync(bytes.subarray(starts[i], starts[i + 1] ?? bytes.length)).toString('utf8')
}
const events = text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
```

Each line is one event, and the first line is the `session` header. A
`system/message` event holds the prompt actually sent, which is the fastest way
to confirm which prompt text one turn used. Correlate a tool call with its
result by `source.callId`. Scanning for the magic bytes is a shortcut: a byte
sequence inside compressed data can match, so verify the first decoded frame
before trusting a scan.

