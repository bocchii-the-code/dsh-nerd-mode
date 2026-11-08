import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

const { decodeSessionFile, scan } = await import('../lib/study-sessions.js')
const { Config, apply, createStudySessionsHandler } = await import('../lib/index.js')

const ROUTE = '/dsh-nerd-mode/api/study-sessions'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-study-sessions-'))
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))
  return { dir, sessionsRoot: join(dir, 'sessions'), indexFile: join(dir, 'study-sessions-index.json') }
}

// One zstd frame per batch, the way the host appends to a log.
function writeSession(sessionsRoot, id, frames, workspace = 'workspace') {
  const directory = join(sessionsRoot, workspace, id)
  mkdirSync(directory, { recursive: true })
  const file = join(directory, 'session.v4.jsonl.zstd')
  const bytes = frames.map((events) =>
    zstdCompressSync(Buffer.from(`${events.map((event) => JSON.stringify(event)).join('\n')}\n`)),
  )
  writeFileSync(file, Buffer.concat(bytes))
  return file
}

function nerdCommand({ commandId = 'cmd-nerd', args, kind = 'success' } = {}) {
  const run = { type: 'command/run', data: { commandId, name: 'nerd-mode' } }
  if (args !== undefined) run.data.args = args
  return [run, { type: 'command/done', data: { commandId, kind } }]
}

function userMessage(text, source = { kind: 'user' }) {
  return {
    type: 'user/message',
    data: { id: 'message-1', role: 'user', source, content: [{ type: 'text', text }] },
  }
}

function skillInvocation(name = 'study-plus') {
  return [userMessage('<skill_content />', { kind: 'skill-invocation', name })]
}

function skillCall(callId = 'call-1', { name = 'study-plus', failed = false } = {}) {
  return [
    { type: 'tool/call', data: { name: 'skill', callId, arguments: JSON.stringify({ name }) } },
    { type: 'tool/result', data: { message: { isError: failed, source: { callId } } } },
  ]
}

function ptcDispatch({ name = 'study-plus', isError = false } = {}) {
  return [{ type: 'tool/ptc-dispatch', data: { name: 'skill', arguments: { name }, isError } }]
}

// Presence in the reply is the Nerd Mode flag, so read both facts from one scan.
function flagsFor(t, ...frames) {
  const { sessionsRoot, indexFile } = fixture(t)
  writeSession(sessionsRoot, 'session-one', frames)
  const reply = scan({ sessionsRoot, indexFile })
  return {
    nerd: 'session-one' in reply.sessions,
    studyPlus: reply.sessions['session-one']?.studyPlus === true,
  }
}

test('a bare /nerd-mode command counts as Nerd Mode', (t) => {
  assert.deepEqual(flagsFor(t, nerdCommand()), { nerd: true, studyPlus: false })
})

test('/nerd-mode off alone does not count', (t) => {
  assert.deepEqual(flagsFor(t, nerdCommand({ args: ' off' })), { nerd: false, studyPlus: false })
})

test('an unfinished or failed /nerd-mode command does not count', (t) => {
  assert.deepEqual(flagsFor(t, nerdCommand({ kind: 'error' })), { nerd: false, studyPlus: false })
  assert.deepEqual(flagsFor(t, [nerdCommand()[0]]), { nerd: false, studyPlus: false })
})

test('a skill invocation counts as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...skillInvocation()]), { nerd: true, studyPlus: true })
})

test('a typed /study-plus command counts as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), userMessage('/study-plus teach me entropy')]), {
    nerd: true,
    studyPlus: true,
  })
})

test('a completed skill tool call counts as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...skillCall()]), { nerd: true, studyPlus: true })
})

test('an unfinished or failed skill tool call does not count as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...skillCall('call-1', { failed: true })]), {
    nerd: true,
    studyPlus: false,
  })
  assert.deepEqual(flagsFor(t, [...nerdCommand(), skillCall()[0]]), { nerd: true, studyPlus: false })
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...skillCall('call-1', { name: 'study' })]), {
    nerd: true,
    studyPlus: false,
  })
})

test('a completed PTC skill dispatch counts as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...ptcDispatch()]), { nerd: true, studyPlus: true })
})

test('a failed PTC skill dispatch does not count as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), ...ptcDispatch({ isError: true })]), {
    nerd: true,
    studyPlus: false,
  })
})

test('a prose mention of study-plus does not count as In-depth', (t) => {
  assert.deepEqual(flagsFor(t, [...nerdCommand(), userMessage('Can study-plus make a quiz?')]), {
    nerd: true,
    studyPlus: false,
  })
  // The host also injects a study-plus prompt that names the command in prose.
  assert.deepEqual(
    flagsFor(t, [
      ...nerdCommand(),
      userMessage('You are the Study tutor.\nThe learner ran /study-plus and typed continue.'),
    ]),
    { nerd: true, studyPlus: false },
  )
})

test('reads events from every zstd frame in the log', (t) => {
  assert.deepEqual(flagsFor(t, nerdCommand(), skillInvocation()), { nerd: true, studyPlus: true })
})

test('a rewritten log keeps the nerd flag and replaces the study-plus flag', (t) => {
  const { sessionsRoot, indexFile } = fixture(t)
  const file = writeSession(sessionsRoot, 'session-one', [[...nerdCommand(), ...skillInvocation()]])
  assert.deepEqual(scan({ sessionsRoot, indexFile }).sessions['session-one'], { studyPlus: true })

  // Compaction can drop the original nerd event, and a later log may drop study-plus.
  writeSession(sessionsRoot, 'session-one', [[userMessage('plain follow-up')]])
  utimesSync(file, new Date(), new Date(Date.now() + 5000))

  assert.deepEqual(scan({ sessionsRoot, indexFile }).sessions['session-one'], { studyPlus: false })
})

test('an unchanged log is not decoded again', (t) => {
  const { sessionsRoot, indexFile } = fixture(t)
  writeSession(sessionsRoot, 'session-one', [nerdCommand()])
  scan({ sessionsRoot, indexFile })

  const decoded = []
  scan({
    sessionsRoot,
    indexFile,
    decode: (file) => {
      decoded.push(file)
      return decodeSessionFile(file)
    },
  })

  assert.deepEqual(decoded, [])
})

test('an empty session tree is ready at once', (t) => {
  const { sessionsRoot, indexFile } = fixture(t)

  assert.deepEqual(scan({ sessionsRoot, indexFile }), {
    phase: 'ready',
    cursor: 0,
    done: 0,
    total: 0,
    sessions: {},
  })
})

test('the scan prunes sessions whose folder is gone', (t) => {
  const { sessionsRoot, indexFile } = fixture(t)
  writeSession(sessionsRoot, 'session-keep', [nerdCommand()], 'workspace-a')
  writeSession(sessionsRoot, 'session-gone', [nerdCommand()], 'workspace-b')
  assert.deepEqual(Object.keys(scan({ sessionsRoot, indexFile }).sessions).sort(), [
    'session-gone',
    'session-keep',
  ])

  rmSync(join(sessionsRoot, 'workspace-b', 'session-gone'), { recursive: true, force: true })

  assert.deepEqual(Object.keys(scan({ sessionsRoot, indexFile }).sessions), ['session-keep'])
})

test('the scan resumes from the cursor without decoding a file twice', (t) => {
  const { sessionsRoot, indexFile } = fixture(t)
  for (let index = 0; index < 45; index += 1) {
    const workspace = index < 25 ? 'workspace-a' : 'workspace-b'
    writeSession(sessionsRoot, `session-${String(index).padStart(2, '0')}`, [nerdCommand()], workspace)
  }

  const decoded = []
  const decode = (file) => {
    decoded.push(file)
    return decodeSessionFile(file)
  }

  const first = scan({ sessionsRoot, indexFile, decode })
  assert.deepEqual([first.cursor, first.done, first.total, first.phase], [20, 20, 45, 'pending'])

  const second = scan({ sessionsRoot, indexFile, decode, cursor: first.cursor })
  assert.deepEqual([second.cursor, second.done, second.total, second.phase], [40, 40, 45, 'pending'])

  const third = scan({ sessionsRoot, indexFile, decode, cursor: second.cursor })
  assert.deepEqual([third.cursor, third.done, third.total, third.phase], [45, 45, 45, 'ready'])
  assert.equal(Object.keys(third.sessions).length, 45)
  assert.equal(decoded.length, 45)
  assert.equal(new Set(decoded).size, 45)
})

function fakeResponse() {
  const response = { status: undefined, headers: undefined, body: undefined }
  response.writeHead = (status, headers) => {
    response.status = status
    response.headers = headers
  }
  response.end = (body) => {
    response.body = body ?? ''
  }
  return response
}

function routeFor({ indexFile, sessionsRoot }, rejection) {
  return createStudySessionsHandler({
    connection: { requestRejection: () => rejection },
    indexFile,
    sessionsRoot,
  })
}

test('the route replies with the history JSON and no-store', async (t) => {
  const options = fixture(t)
  writeSession(options.sessionsRoot, 'session-one', [nerdCommand()])
  const response = fakeResponse()

  await routeFor(options, undefined)(
    { method: 'GET', url: `${ROUTE}?cursor=0` },
    response,
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(response.body), {
    phase: 'ready',
    cursor: 1,
    done: 1,
    total: 1,
    sessions: { 'session-one': { studyPlus: false } },
  })
})

test('the route rejects a non-GET request with 405', async (t) => {
  const response = fakeResponse()

  await routeFor(fixture(t), undefined)({ method: 'POST', url: ROUTE }, response)

  assert.equal(response.status, 405)
})

test('the route replies with the rejection status from the connection', async (t) => {
  for (const rejection of [401, 403]) {
    const response = fakeResponse()
    await routeFor(fixture(t), rejection)({ method: 'GET', url: ROUTE }, response)
    assert.equal(response.status, rejection)
  }
})

test('the route replies 500 when the index cannot be read', async (t) => {
  const options = fixture(t)
  const indexFile = join(options.dir, 'index-directory')
  mkdirSync(indexFile)
  const response = fakeResponse()

  await routeFor({ ...options, indexFile }, undefined)({ method: 'GET', url: ROUTE }, response)

  assert.equal(response.status, 500)
  assert.equal(typeof JSON.parse(response.body).error, 'string')
})

test('apply registers the route inside an effect that disposes it', () => {
  const routes = new Map()
  const disposers = []
  const ctx = {
    sessionProjections: { register() {}, stateOf: () => ({ active: false }) },
    systemPrompt: { section() {} },
    commands: { register() {} },
    webServer: {
      register(route) {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
    connection: { requestRejection: () => undefined },
    effect(register) {
      disposers.push(register())
    },
    on() {
      return () => {}
    },
    inject(_names, register) {
      register(ctx)
    },
  }

  apply(ctx, Config({ section: 'policy' }))

  assert.equal(routes.get(ROUTE).kind, 'exact')
  assert.equal(typeof routes.get(ROUTE).handler, 'function')

  for (const dispose of disposers) if (typeof dispose === 'function') dispose()
  assert.equal(routes.size, 0)
})
