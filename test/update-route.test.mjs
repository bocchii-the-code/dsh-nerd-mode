import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

const { createUpdateHandler, githubTarget } = await import('../lib/index.js')

const ROUTE = '/dsh-nerd-mode/api/update'
const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version

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

function fakeRequest({ method = 'GET', url = ROUTE, body } = {}) {
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body)
    },
  }
}

function handlerFor(options = {}) {
  return createUpdateHandler({
    connection: { requestRejection: () => undefined },
    ...options,
  })
}

function profileFixture(t, spec) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-update-profile-'))
  t.after(() => rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))
  if (spec !== undefined) {
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ dependencies: { 'dsh-nerd-mode': spec } }),
    )
  }
  return directory
}

function registryResponse(version) {
  return { ok: true, status: 200, json: async () => ({ 'dist-tags': { latest: version } }) }
}

function githubResponse(version) {
  return { ok: true, status: 200, json: async () => ({ version }) }
}

// A pnpm stand-in on PATH: records the working directory and arguments, then
// exits with the requested code. The real installer runs it, so the test needs
// no spawn seam.
function pnpmShim(t, { exit = 0, stderr = '' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-update-bin-'))
  const record = join(directory, 'record.txt')
  t.after(() => rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))
  const windows = process.platform === 'win32'
  const lines = [
    windows ? '@echo off' : '#!/bin/sh',
    windows ? `> "${record}" echo %CD% %*` : `printf '%s %s' "$PWD" "$*" > "${record}"`,
    ...(stderr === '' ? [] : [windows ? `echo ${stderr} 1>&2` : `echo ${stderr} >&2`]),
    windows ? `exit /b ${exit}` : `exit ${exit}`,
  ]
  const file = join(directory, windows ? 'pnpm.cmd' : 'pnpm')
  writeFileSync(file, `${lines.join(windows ? '\r\n' : '\n')}\r\n`)
  if (!windows) chmodSync(file, 0o755)
  const previous = process.env.PATH
  process.env.PATH = `${directory}${delimiter}${previous ?? ''}`
  t.after(() => {
    process.env.PATH = previous
  })
  return record
}

test('the update route replies with the rejection status from the connection', async () => {
  for (const rejection of [401, 403]) {
    const response = fakeResponse()
    const handler = createUpdateHandler({ connection: { requestRejection: () => rejection } })
    await handler(fakeRequest(), response)
    assert.equal(response.status, rejection)
    assert.equal(response.body, rejection === 401 ? 'unauthorized' : 'forbidden')
  }
})

test('the update route rejects a method other than GET or POST with 405', async () => {
  const response = fakeResponse()

  await handlerFor({ profile: null })(fakeRequest({ method: 'PUT' }), response)

  assert.equal(response.status, 405)
  assert.deepEqual(JSON.parse(response.body), { error: 'Method not allowed.' })
})

test('GET reports the installed version and the newest npm version', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  const response = fakeResponse()

  await handlerFor({ profile: directory, fetchImpl: async () => registryResponse('0.6.0') })(
    fakeRequest(),
    response,
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(response.body), {
    installedVersion: PACKAGE_VERSION,
    source: 'npm',
    latestVersion: '0.6.0',
    channel: 'npm',
    registry: 'https://registry.npmjs.org/',
    error: null,
    github: null,
  })
})

test('GET falls back to the mirror when npm fails', async (t) => {
  const directory = profileFixture(t, '^0.5.0')
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    if (url.startsWith('https://registry.npmjs.org/')) throw new Error('offline')
    return registryResponse('0.7.0')
  }
  const response = fakeResponse()

  await handlerFor({ profile: directory, fetchImpl })(fakeRequest(), response)

  assert.deepEqual(calls.filter((url) => url.startsWith('https://registry.')), [
    'https://registry.npmjs.org/dsh-nerd-mode',
    'https://registry.npmmirror.com/dsh-nerd-mode',
  ])
  assert.deepEqual(JSON.parse(response.body), {
    installedVersion: PACKAGE_VERSION,
    source: 'npm',
    latestVersion: '0.7.0',
    channel: 'npm',
    registry: 'https://registry.npmmirror.com/',
    error: null,
    github: null,
  })
})

test('GET keeps a 200 and sets error when both registries fail', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async () => {
      throw new Error('offline')
    },
  })(fakeRequest(), response)

  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.installedVersion, PACKAGE_VERSION)
  assert.equal(body.source, 'npm')
  assert.equal(body.latestVersion, null)
  assert.equal(body.registry, null)
  assert.match(body.error, /offline/)
})

test('GET treats a non-semver dist-tag as a failed registry', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  const response = fakeResponse()

  await handlerFor({ profile: directory, fetchImpl: async () => registryResponse('0.6.0-beta.1') })(
    fakeRequest(),
    response,
  )

  const body = JSON.parse(response.body)
  assert.equal(response.status, 200)
  assert.equal(body.latestVersion, null)
  assert.equal(body.registry, null)
  assert.match(body.error, /no version/)
})

test('force=1 bypasses the 60 s registry cache', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  let calls = 0
  const handler = handlerFor({
    profile: directory,
    fetchImpl: async (url) => {
      if (url.startsWith('https://registry.')) calls += 1
      return registryResponse('0.6.0')
    },
  })

  await handler(fakeRequest(), fakeResponse())
  await handler(fakeRequest(), fakeResponse())
  assert.equal(calls, 1)

  await handler(fakeRequest({ url: `${ROUTE}?force=1` }), fakeResponse())
  assert.equal(calls, 2)
})

test('a link install skips the registry', async (t) => {
  const directory = profileFixture(t, 'link:../dsh-nerd-mode')
  const fetchImpl = async () => {
    throw new Error('network used')
  }
  const response = fakeResponse()

  await handlerFor({ profile: directory, fetchImpl })(fakeRequest(), response)

  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), {
    installedVersion: PACKAGE_VERSION,
    source: 'link',
    latestVersion: null,
    channel: null,
    registry: null,
    error: null,
    github: null,
  })

  const noProfile = fakeResponse()
  await handlerFor({ profile: null, fetchImpl })(fakeRequest(), noProfile)
  assert.equal(JSON.parse(noProfile.body).source, 'link')
})

test('the source follows the manifest spec', async (t) => {
  const cases = [
    ['1.0.0', 'npm'],
    ['^0.5.0', 'npm'],
    ['link:../dsh-nerd-mode', 'link'],
    ['github:bocchii-the-code/dsh-nerd-mode', 'github'],
    ['git+https://github.com/bocchii-the-code/dsh-nerd-mode.git', 'github'],
    ['git@github.com:bocchii-the-code/dsh-nerd-mode.git', 'github'],
    ['https://example.com/dsh-nerd-mode.git', 'github'],
  ]
  const fetchImpl = async () => {
    throw new Error('network used')
  }

  for (const [spec, source] of cases) {
    const response = fakeResponse()
    await handlerFor({ profile: profileFixture(t, spec), fetchImpl })(fakeRequest(), response)
    assert.equal(JSON.parse(response.body).source, source, spec)
  }
})

test('POST rejects a body that is not JSON or not a version', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  const handler = handlerFor({ profile: directory })

  for (const body of ['{', JSON.stringify({ version: '1.2' }), JSON.stringify({})]) {
    const response = fakeResponse()
    await handler(fakeRequest({ method: 'POST', body }), response)
    assert.equal(response.status, 400, body)
    assert.equal(typeof JSON.parse(response.body).error, 'string')
  }
})

test('POST refuses a link install', async (t) => {
  const directory = profileFixture(t, 'link:../dsh-nerd-mode')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installNpm: async () => {
      throw new Error('install ran')
    },
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '1.2.3' }) }), response)

  assert.equal(response.status, 409)
  assert.deepEqual(JSON.parse(response.body), { error: 'This copy cannot be updated from this page.' })
})

test('POST refuses a second run while one is in progress', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  let release
  let started
  const startSignal = new Promise((resolve) => {
    started = resolve
  })
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const handler = handlerFor({
    profile: directory,
    installNpm: () => {
      started()
      return gate
    },
  })

  const first = fakeResponse()
  const running = handler(
    fakeRequest({ method: 'POST', body: JSON.stringify({ version: '1.2.3' }) }),
    first,
  )
  await startSignal

  const second = fakeResponse()
  await handler(
    fakeRequest({ method: 'POST', body: JSON.stringify({ version: '1.2.4' }) }),
    second,
  )
  assert.equal(second.status, 409)
  assert.deepEqual(JSON.parse(second.body), { error: 'An update is already running.' })

  release()
  await running
  assert.equal(first.status, 200)
  assert.deepEqual(JSON.parse(first.body), { installedVersion: '1.2.3' })
})

test('POST runs pnpm add with the exact version and the profile as cwd', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  const record = pnpmShim(t)
  const response = fakeResponse()

  await handlerFor({ profile: directory })(
    fakeRequest({ method: 'POST', body: JSON.stringify({ version: '1.2.3' }) }),
    response,
  )

  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), { installedVersion: '1.2.3' })
  assert.equal(
    readFileSync(record, 'utf8').trim(),
    `${directory} add dsh-nerd-mode@1.2.3 --save-exact`,
  )
})

test('POST returns 500 with the stderr tail when pnpm fails', async (t) => {
  const directory = profileFixture(t, '1.0.0')
  pnpmShim(t, { exit: 1, stderr: 'ERR_PNPM_FETCH_404' })
  const response = fakeResponse()

  await handlerFor({ profile: directory })(
    fakeRequest({ method: 'POST', body: JSON.stringify({ version: '1.2.3' }) }),
    response,
  )

  assert.equal(response.status, 500)
  assert.deepEqual(JSON.parse(response.body), { error: 'ERR_PNPM_FETCH_404' })
})

test('githubTarget reads the repo, ref, and pinned state', () => {
  const cases = [
    ['github:bocchii-the-code/dsh-nerd-mode', 'bocchii-the-code/dsh-nerd-mode', null, false],
    ['bocchii-the-code/dsh-nerd-mode', 'bocchii-the-code/dsh-nerd-mode', null, false],
    ['github:Bocchii-the-Code/DSH-Nerd-Mode#main', 'bocchii-the-code/dsh-nerd-mode', 'main', false],
    ['github:bocchii-the-code/dsh-nerd-mode#v0.5.0', 'bocchii-the-code/dsh-nerd-mode', 'v0.5.0', true],
    ['github:bocchii-the-code/dsh-nerd-mode#semver:^0.5.0', 'bocchii-the-code/dsh-nerd-mode', 'semver:^0.5.0', true],
    ['github:bocchii-the-code/dsh-nerd-mode#e5428220856819cd1c46740473ed6b098c8d9f0c', 'bocchii-the-code/dsh-nerd-mode', 'e5428220856819cd1c46740473ed6b098c8d9f0c', true],
    ['git+https://github.com/bocchii-the-code/dsh-nerd-mode.git#dev', 'bocchii-the-code/dsh-nerd-mode', 'dev', false],
    ['git@github.com:bocchii-the-code/dsh-nerd-mode.git', 'bocchii-the-code/dsh-nerd-mode', null, false],
    ['https://example.com/dsh-nerd-mode.git', null],
    ['1.0.0', null],
    ['@scope/name', null],
  ]
  for (const [spec, repo, ref, pinned] of cases) {
    const target = githubTarget(spec)
    if (repo === null) {
      assert.equal(target, null, spec)
      continue
    }
    assert.deepEqual(target, { repo, ref, pinned }, spec)
  }
})

test('GET reads the official repository version from the tracked branch', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode#dev')
  const calls = []
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async (url) => {
      calls.push(url)
      return githubResponse('0.6.0')
    },
  })(fakeRequest(), response)

  assert.deepEqual(
    calls.filter((url) => url.startsWith('https://raw.githubusercontent.com/')),
    ['https://raw.githubusercontent.com/bocchii-the-code/dsh-nerd-mode/dev/package.json'],
  )
  assert.deepEqual(JSON.parse(response.body), {
    installedVersion: PACKAGE_VERSION,
    source: 'github',
    latestVersion: '0.6.0',
    channel: 'github',
    registry: 'https://raw.githubusercontent.com/',
    error: null,
    github: {
      repo: 'bocchii-the-code/dsh-nerd-mode',
      ref: 'dev',
      pinned: false,
      official: true,
    },
  })
})

test('GET reads HEAD when the spec names no ref', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode')
  const calls = []
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async (url) => {
      calls.push(url)
      return githubResponse('0.6.0')
    },
  })(fakeRequest(), response)

  assert.deepEqual(
    calls.filter((url) => url.startsWith('https://raw.githubusercontent.com/')),
    ['https://raw.githubusercontent.com/bocchii-the-code/dsh-nerd-mode/HEAD/package.json'],
  )
})

test('GET skips a pinned github ref', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode#v0.5.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async () => {
      throw new Error('network used')
    },
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(body.latestVersion, null)
  assert.equal(body.error, null)
  assert.deepEqual(body.github, {
    repo: 'bocchii-the-code/dsh-nerd-mode',
    ref: 'v0.5.0',
    pinned: true,
    official: true,
  })
})

test('GET skips a repository other than the official one', async (t) => {
  const directory = profileFixture(t, 'github:someone/dsh-nerd-mode')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async () => {
      throw new Error('network used')
    },
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(body.latestVersion, null)
  assert.deepEqual(body.github, {
    repo: 'someone/dsh-nerd-mode',
    ref: null,
    pinned: false,
    official: false,
  })
})

test('GET keeps a 200 and sets error when the repository fails', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(response.status, 200)
  assert.equal(body.latestVersion, null)
  assert.match(body.error, /HTTP 404/)
})

test('POST re-resolves the github spec and reports the version on disk', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode')
  const installed = join(directory, 'node_modules', 'dsh-nerd-mode')
  mkdirSync(installed, { recursive: true })
  writeFileSync(join(installed, 'package.json'), JSON.stringify({ version: '0.6.0' }))
  const seen = []
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installGit: async (spec) => {
      seen.push(spec)
    },
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '0.6.0' }) }), response)

  assert.deepEqual(seen, ['github:bocchii-the-code/dsh-nerd-mode'])
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), { installedVersion: '0.6.0' })
})

test('POST refuses a pinned github ref', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode#v0.5.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installGit: async () => {
      throw new Error('install ran')
    },
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '0.6.0' }) }), response)

  assert.equal(response.status, 409)
  assert.deepEqual(JSON.parse(response.body), { error: 'This copy is pinned to an exact ref.' })
})

test('POST refuses a repository other than the official one', async (t) => {
  const directory = profileFixture(t, 'github:someone/dsh-nerd-mode')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installGit: async () => {
      throw new Error('install ran')
    },
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '0.6.0' }) }), response)

  assert.equal(response.status, 409)
  assert.deepEqual(JSON.parse(response.body), { error: 'This copy comes from another repository.' })
})

test('GET takes the higher version and names its channel', async (t) => {
  const directory = profileFixture(t, '^0.5.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async (url) => (
      url.startsWith('https://raw.githubusercontent.com/') ? githubResponse('0.7.0') : registryResponse('0.6.0')
    ),
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(body.latestVersion, '0.7.0')
  assert.equal(body.channel, 'github')
  assert.equal(body.error, null)
})

test('GET keeps the npm channel when it is higher', async (t) => {
  const directory = profileFixture(t, '^0.5.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async (url) => (
      url.startsWith('https://raw.githubusercontent.com/') ? githubResponse('0.6.0') : registryResponse('0.7.0')
    ),
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(body.latestVersion, '0.7.0')
  assert.equal(body.channel, 'npm')
})

test('GET ignores a failing channel when the other answers', async (t) => {
  const directory = profileFixture(t, '^0.5.0')
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    fetchImpl: async (url) => {
      if (url.startsWith('https://raw.githubusercontent.com/')) throw new Error('no github')
      return registryResponse('0.6.0')
    },
  })(fakeRequest(), response)

  const body = JSON.parse(response.body)
  assert.equal(body.latestVersion, '0.6.0')
  assert.equal(body.error, null)
})

test('POST switches an npm install to GitHub', async (t) => {
  const directory = profileFixture(t, '^0.5.0')
  const seen = []
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installGit: async (spec) => {
      seen.push(spec)
    },
    readDisk: () => '0.7.0',
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '0.7.0', channel: 'github' }) }), response)

  assert.deepEqual(seen, ['github:bocchii-the-code/dsh-nerd-mode'])
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), { installedVersion: '0.7.0' })
})

test('POST switches a GitHub install to npm', async (t) => {
  const directory = profileFixture(t, 'github:bocchii-the-code/dsh-nerd-mode#dev')
  const seen = []
  const response = fakeResponse()

  await handlerFor({
    profile: directory,
    installNpm: async (version) => {
      seen.push(version)
    },
  })(fakeRequest({ method: 'POST', body: JSON.stringify({ version: '0.7.0', channel: 'npm' }) }), response)

  assert.deepEqual(seen, ['0.7.0'])
  assert.deepEqual(JSON.parse(response.body), { installedVersion: '0.7.0' })
})
