/**
 * The Study Sessions history index. It reads the session logs the host writes
 * and caches the two facts the panel needs: whether Nerd Mode was ever on, and
 * whether a completed `/study-plus` invocation appears. Kept free of host
 * imports like `lib/fold.js`, so it runs under plain node. See ADR 0021.
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const COMMAND = 'nerd-mode'
const STUDY_PLUS = 'study-plus'
const SESSION_FILE = 'session.v4.jsonl.zstd'
const DEFAULT_INDEX_FILE = join(homedir(), '.dsh', 'study-sessions-index.json')
const DEFAULT_SESSIONS_ROOT = join(homedir(), '.dsh', 'sessions')
const DEFAULT_CHUNK_SIZE = 20
const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
// A command must lead the message. The host injects study-plus prompts that
// name the command inside prose, and those must not count as an invocation.
const DIRECT_COMMAND = /^\/study-plus(?=\s|$)/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function messageText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function skillNameOf(argumentText) {
  if (typeof argumentText !== 'string') return undefined
  try {
    return JSON.parse(argumentText)?.name
  } catch {
    return undefined
  }
}

/**
 * Read the two history facts from one session's decoded events.
 * @param events - decoded session log events, in log order
 * @returns {{ nerd: boolean, studyPlus: boolean }} `nerd` means Nerd Mode was
 * switched on at least once, `studyPlus` means a completed `/study-plus`
 * invocation appears. Malformed events are ignored.
 */
export function classify(events) {
  const successfulCommands = new Set()
  const wantedCommands = new Set()
  const skillCalls = new Set()
  const completedCalls = new Set()
  let studyPlus = false

  for (const event of events) {
    const data = event?.data
    if (event?.type === 'command/run') {
      if (data?.name !== COMMAND) continue
      // A bare /nerd-mode means on, matching lib/fold.js.
      const args = typeof data.args === 'string' ? data.args : ''
      if (args.trim().toLowerCase() !== 'off' && typeof data.commandId === 'string') {
        wantedCommands.add(data.commandId)
      }
    } else if (event?.type === 'command/done') {
      if (data?.kind === 'success' && typeof data.commandId === 'string') {
        successfulCommands.add(data.commandId)
      }
    } else if (event?.type === 'user/message') {
      const source = data?.source
      if (source?.kind === 'skill-invocation') {
        if (source.name === STUDY_PLUS) studyPlus = true
      } else if (source?.kind === 'user' && DIRECT_COMMAND.test(messageText(data).trimStart())) {
        studyPlus = true
      }
    } else if (event?.type === 'tool/call') {
      if (data?.name === 'skill' && typeof data.callId === 'string' && skillNameOf(data.arguments) === STUDY_PLUS) {
        skillCalls.add(data.callId)
      }
    } else if (event?.type === 'tool/result') {
      const message = data?.message
      if (message?.isError !== true && typeof message?.source?.callId === 'string') {
        completedCalls.add(message.source.callId)
      }
    } else if (event?.type === 'tool/ptc-dispatch') {
      // A skill load inside run_code arrives as a dispatch and carries its own outcome.
      if (data?.name === 'skill' && data?.arguments?.name === STUDY_PLUS && data?.isError !== true) {
        studyPlus = true
      }
    }
  }

  if (!studyPlus) {
    studyPlus = [...skillCalls].some((callId) => completedCalls.has(callId))
  }
  return {
    nerd: [...wantedCommands].some((commandId) => successfulCommands.has(commandId)),
    studyPlus,
  }
}

/**
 * Decode a session log into events.
 *
 * The file is a chain of zstd frames, one per append batch. Whole-file
 * decompression stops at the first frame, which holds only the header, so each
 * frame is decoded on its own.
 *
 * @param file - path to a `session.v4.jsonl.zstd` file
 * @returns the decoded events; malformed frames and lines are dropped
 * @throws when the file itself cannot be read
 */
export function decodeSessionFile(file) {
  const bytes = readFileSync(file)
  const starts = []
  for (let offset = 0; offset <= bytes.length - MAGIC.length; offset += 1) {
    if (MAGIC.every((byte, index) => bytes[offset + index] === byte)) starts.push(offset)
  }

  const events = []
  for (let index = 0; index < starts.length; index += 1) {
    let text
    try {
      text = zstdDecompressSync(bytes.subarray(starts[index], starts[index + 1] ?? bytes.length)).toString('utf8')
    } catch {
      // A magic byte sequence can occur inside compressed data, so a failed
      // slice is expected. See docs/agents/dsh-session-api.md.
      continue
    }
    for (const line of text.split('\n')) {
      if (line === '') continue
      try {
        events.push(JSON.parse(line))
      } catch {
        // A crash can leave a partial trailing line. One bad record must not
        // hide the rest of the log.
      }
    }
  }
  return events
}

function readIndex(file) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    // A missing index is a first run. Any other failure reaches the panel.
    throw error
  }
  try {
    const index = JSON.parse(text)
    return isRecord(index) ? index : {}
  } catch {
    // A corrupt cache is rebuilt from the logs, not reported as a failure.
    return {}
  }
}

function writeIndex(file, index) {
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  writeFileSync(temp, JSON.stringify(index))
  // Rename keeps the previous index readable if the process dies mid-write.
  renameSync(temp, file)
}

function listSessionFiles(root) {
  let workspaces
  try {
    workspaces = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return { files: [], complete: true }
    throw error
  }

  const files = []
  let complete = true
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue
    let sessions
    try {
      sessions = readdirSync(join(root, workspace.name), { withFileTypes: true })
    } catch {
      // One locked workspace must not blank the others, and must not prune them.
      complete = false
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const file = join(root, workspace.name, session.name, SESSION_FILE)
      try {
        const stat = statSync(file)
        if (stat.isFile()) {
          files.push({ id: session.name, file, mtimeMs: stat.mtimeMs, size: stat.size })
        }
      } catch {
        // A session folder without a readable log is not a session yet.
      }
    }
  }
  files.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  return { files, complete }
}

/**
 * Classify one chunk of the session tree and persist the index.
 *
 * @param options
 * @param options.cursor - index of the first file in the sorted session list to
 * process; negative and non-integer values read as 0
 * @param options.indexFile - index path; defaults to
 * `~/.dsh/study-sessions-index.json`
 * @param options.sessionsRoot - session tree; defaults to `~/.dsh/sessions`
 * @param options.chunkSize - files to process per call; defaults to 20
 * @param options.decode - decoder override for tests; defaults to
 * `decodeSessionFile`
 * @returns {{ phase: 'pending' | 'ready', cursor: number, done: number,
 * total: number, sessions: Record<string, { studyPlus: boolean }> }} `cursor`
 * is the next call's starting index and equals `total` once `phase` is
 * `ready`. `done` counts files visited so far. A key in `sessions` means Nerd
 * Mode was on at least once for that id.
 * @throws when the index or the session tree cannot be read or written
 */
export function scan({
  cursor = 0,
  indexFile = DEFAULT_INDEX_FILE,
  sessionsRoot = DEFAULT_SESSIONS_ROOT,
  chunkSize = DEFAULT_CHUNK_SIZE,
  decode = decodeSessionFile,
} = {}) {
  const { files, complete } = listSessionFiles(sessionsRoot)
  const index = readIndex(indexFile)
  if (complete) {
    const live = new Set(files.map(({ id }) => id))
    for (const id of Object.keys(index)) {
      if (!live.has(id)) delete index[id]
    }
  }

  const start = Number.isInteger(cursor) && cursor > 0 ? cursor : 0
  const size = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : DEFAULT_CHUNK_SIZE
  const end = Math.min(start + size, files.length)
  for (let position = start; position < end; position += 1) {
    const { id, file, mtimeMs, size: bytes } = files[position]
    const previous = index[id]
    if (previous?.mtimeMs === mtimeMs && previous?.size === bytes) continue

    let flags
    try {
      flags = classify(decode(file))
    } catch {
      // An unreadable session keeps its previous record and retries next scan.
      continue
    }
    index[id] = {
      mtimeMs,
      size: bytes,
      // Compaction can drop the original event. A fact that disappeared from a
      // rewritten log must not resurface as a missing session.
      nerd: flags.nerd || previous?.nerd === true,
      studyPlus: flags.studyPlus,
    }
  }
  writeIndex(indexFile, index)

  const sessions = {}
  for (const [id, entry] of Object.entries(index)) {
    if (entry?.nerd === true) sessions[id] = { studyPlus: entry.studyPlus === true }
  }
  return {
    phase: end >= files.length ? 'ready' : 'pending',
    cursor: end,
    done: end,
    total: files.length,
    sessions,
  }
}
