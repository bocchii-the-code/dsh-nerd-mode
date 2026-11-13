/**
 * Nerd Mode: a per-session switch. While it is on, one prompt section joins
 * every request and the `study` skill becomes the default answer shape. State
 * folds from the session log, so it survives compaction, resume, and fork. The
 * tool set never changes.
 *
 * The section registers at the profile level, not inside a preset, so it
 * reaches every agent in every preset. See docs/adr/0008.
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMMAND, KEY, fold, init } from './fold.js'
import { scan } from './study-sessions.js'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-nerd-mode'
export const PACKAGE_NAME = 'dsh-nerd-mode'
export const inject = ['systemPrompt', 'sessionProjections']

// The prompt text ships with the package. Keeping it out of the config stops
// every profile patch from carrying a stale copy of it.
const BUNDLED_SECTION = readFileSync(
  fileURLToPath(new URL('../assets/section.md', import.meta.url)),
  'utf8',
).trim()

export const Config = z.object({
  section: z.string().pattern(/\S/).default(BUNDLED_SECTION),
  recallSessionEnabled: z.boolean().default(false).volatile(),
  unseenQuestionCount: z.number().step(1).min(0).max(10).default(3).volatile(),
  unseenQuestionType: z.union([
    z.const('short-answer'),
    z.const('multiple-choice'),
    z.const('mixed'),
  ]).default('short-answer').volatile(),
})

const SECTION = 'study:policy'
// Between PLAN_POLICY (500) and TEAM_POLICY (600).
const SECTION_ORDER = 550
const STUDY_SESSIONS_PATH = '/dsh-nerd-mode/api/study-sessions'
const UPDATE_PATH = '/dsh-nerd-mode/api/update'
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const REGISTRIES = ['https://registry.npmjs.org/', 'https://registry.npmmirror.com/']
const REGISTRY_TIMEOUT_MS = 10_000
const UPDATE_CACHE_MS = 60_000
const BODY_LIMIT = 1024
const INSTALL_TIMEOUT_MS = 300_000
const OFFICIAL_REPO = 'bocchii-the-code/dsh-nerd-mode'
const GITHUB_SPEC = `github:${OFFICIAL_REPO}`
const RAW_BASE = 'https://raw.githubusercontent.com/'
// A commit, a tag, or a semver range never moves on its own.
const PINNED_REF = /^(?:[0-9a-f]{7,40}|v?\d+\.\d+(?:\.\d+)*(?:[-+].*)?|semver:.*)$/i

// This copy's version cannot change while the module is loaded.
const PACKAGE_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
).version
const studyPlusDefaultsBySession = new WeakMap()
const directStudyPlusBySession = new WeakMap()
// A PTC skill load leaves no message in the history, so keep its id for later
// turns the way an injected skill message would.
const ptcStudyPlusBySession = new WeakMap()
const SKILL_COMMAND = /(^|\s)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g

// shortcut: parse-only schemas, no zod. The projection registry calls `parse`
// and nothing else. Upgrade to zod if the host starts introspecting schemas.
const stateSchema = {
  parse: (value) => ({
    active: value?.active === true,
    running:
      value?.running && typeof value.running.commandId === 'string'
        ? { commandId: value.running.commandId, wanted: value.running.wanted === true }
        : null,
  }),
}

const viewSchema = { parse: (value) => ({ active: value?.active === true }) }

function studyPlusSettings(config, session, invocationId) {
  let defaults = studyPlusDefaultsBySession.get(session)
  if (defaults?.invocationId !== invocationId) {
    defaults = {
      invocationId,
      recallSessionEnabled: config.recallSessionEnabled?.get?.() ?? false,
      unseenQuestionCount: config.unseenQuestionCount?.get?.() ?? 3,
      unseenQuestionType: config.unseenQuestionType?.get?.() ?? 'short-answer',
    }
    studyPlusDefaultsBySession.set(session, defaults)
  }

  return [
    '',
    '',
    'Study-plus profile defaults for this tracked session:',
    `- Recall Session: ${defaults.recallSessionEnabled ? 'enabled' : 'disabled'}.`,
    `- Post-lecture questions: ${defaults.unseenQuestionCount}; type: ${defaults.unseenQuestionType}.`,
    'Apply these defaults only during tracked study-plus sessions. Ignore them for ordinary study and all other requests.',
    'An explicit preference in the current /study-plus request overrides its profile default for this session and does not update the profile.',
  ].join('\n')
}

/** Return the message id when the message is a direct /study-plus command, else undefined. */
function directStudyPlusId(message) {
  if (message?.source?.kind !== 'user') return undefined
  const text = (message.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  return [...text.matchAll(SKILL_COMMAND)].at(-1)?.[2] === 'study-plus' ? message.id : undefined
}

function studyPlusInvocation(session) {
  const directInvocation = directStudyPlusBySession.get(session)
  if (directInvocation !== undefined) return directInvocation
  const ptcInvocation = ptcStudyPlusBySession.get(session)
  if (ptcInvocation !== undefined) return ptcInvocation

  // The host returns the full surface history here, not just this turn. See docs/agents/dsh-session-api.md.
  const invocation = session.deriveMessages().findLast((message) => message.source?.kind === 'skill-invocation')
  if (invocation?.source.name === 'study-plus') return invocation.id

  const completedCalls = new Set()
  let loadedId
  let directId
  let skillCall
  let ptcSkillCall
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const event = session.eventAt(seq)
    if (event?.type === 'turn/start') break
    // A resumed, forked, or seeded log may carry a partial event payload, so
    // every nested read here is guarded. One bad record must not fail a turn.
    if (event?.type === 'tool/result') {
      const result = event.data?.message
      if (result !== undefined && result.isError !== true && result.source?.callId !== undefined) {
        completedCalls.add(result.source.callId)
      }
    } else if (event?.type === 'tool/call' && event.data?.name === 'skill') {
      try {
        if (JSON.parse(event.data.arguments).name === 'study-plus') skillCall = event.data.callId
      } catch {}
    } else if (event?.type === 'tool/ptc-dispatch' && event.data?.name === 'skill') {
      // PTC records a skill call made inside run_code as a dispatch, not as a
      // `tool/call`, and the dispatch event itself carries the outcome.
      if (event.data.isError !== true && event.data.arguments?.name === 'study-plus') {
        ptcSkillCall = event.data.subCallId
      }
    } else if (event?.type === 'user/message') {
      // `user/message` stores the message fields directly in `data`; only
      // `tool/result` and `system/message` wrap them under `data.message`.
      const message = event.data
      if (message?.source?.kind === 'skill-invocation') {
        if (message.source.name === 'study-plus') loadedId = message.id
      } else {
        directId = directStudyPlusId(message) ?? directId
      }
    }
  }

  // A skill load counts only when its tool call completed. A typed command counts at once.
  if (skillCall !== undefined) {
    return completedCalls.has(skillCall) ? loadedId ?? directId ?? skillCall : undefined
  }
  if (ptcSkillCall !== undefined) {
    ptcStudyPlusBySession.set(session, ptcSkillCall)
    return loadedId ?? directId ?? ptcSkillCall
  }
  return loadedId ?? directId
}

const projection = {
  key: KEY,
  stateVersion: 1,
  stateSchema,
  init,
  apply: fold,
  wire: {
    viewSchema,
    view: (state) => ({ active: state.active }),
  },
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function cursorOf(req) {
  const match = /[?&]cursor=(\d+)/.exec(req?.url ?? '')
  return match === null ? 0 : Number.parseInt(match[1], 10)
}

/**
 * Build the read-only history route handler.
 *
 * `webServer.register` adds no auth fence, so the connection service decides
 * first: a missing cookie is 401 and a bad Host or Origin is 403.
 *
 * @param options
 * @param options.connection - the host connection service
 * @param options.indexFile - forwarded to `scan`; tests point it at a temp file
 * @param options.sessionsRoot - forwarded to `scan`; tests point it at a temp tree
 * @returns {(req, res) => Promise<void>} replies `{ phase, cursor, done,
 * total, sessions }` with `no-store`, `{ error }` with status 500, or the
 * rejection status
 */
export function createStudySessionsHandler({ connection, ...scanOptions }) {
  return async function studySessionsRoute(req, res) {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) {
      res.writeHead(rejection)
      res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' })
      return
    }
    try {
      sendJson(res, 200, scan({ ...scanOptions, cursor: cursorOf(req) }))
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Return the parsed `package.json` under `root`, or undefined when it is absent.
 *
 * Args:
 *   root: a directory that may hold a manifest.
 * Returns:
 *   The parsed object, or undefined when the file is missing or not JSON.
 */
function manifestOf(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {
    return undefined
  }
}

/** Return the manifest's dependency spec for this package, if any. */
function dependencySpec(manifest) {
  return manifest?.dependencies?.[PACKAGE_NAME] ?? manifest?.devDependencies?.[PACKAGE_NAME]
}

/**
 * Read the repository and ref from a GitHub dependency spec.
 *
 * Args:
 *   spec: a manifest value, possibly undefined or not a string.
 * Returns:
 *   `{ repo, ref, pinned }`, or null when the spec names another source.
 *   `repo` is a lowercase `owner/repo`; `ref` is null when the spec tracks the
 *   default branch; `pinned` is true for a commit, a tag, or a semver range.
 */
export function githubTarget(spec) {
  if (typeof spec !== 'string') return null
  const [source, ref = null] = spec.split('#')
  const patterns = [
    /^github:([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^(?!@)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/,
    /^git\+https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^git\+ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(source)
    if (match === null) continue
    return {
      repo: match[1].toLowerCase(),
      ref,
      pinned: ref !== null && PINNED_REF.test(ref),
    }
  }
  return null
}

/**
 * Classify a manifest spec as an npm, github, or local install.
 *
 * Args:
 *   spec: the manifest value, possibly undefined or not a string.
 * Returns:
 *   `link` for a missing or `link:` spec, `github` for a GitHub spec, and
 *   `npm` for everything else.
 */
function sourceOf(spec) {
  if (typeof spec !== 'string' || spec.startsWith('link:')) return 'link'
  if (githubTarget(spec) !== null) return 'github'
  if (spec.startsWith('git+') || spec.startsWith('git@') || spec.endsWith('.git')) return 'github'
  return 'npm'
}

/**
 * Return the profile root that holds this copy, or null when none lists it.
 *
 * pnpm nests the real package under `node_modules/.pnpm`, so the last
 * `node_modules` segment is not always the profile. Walk the segments from
 * last to first and take the first root whose manifest names the package.
 */
function profileRoot() {
  const segments = fileURLToPath(import.meta.url).split(/[\\/]/)
  for (let index = segments.length - 1; index > 0; index -= 1) {
    if (segments[index] !== 'node_modules') continue
    const root = segments.slice(0, index).join(sep)
    if (dependencySpec(manifestOf(root)) !== undefined) return root
  }
  return null
}

/**
 * Report this copy's version, install source, and manifest spec.
 *
 * Args:
 *   profile: the profile root, or null when the module sits outside one.
 * Returns:
 *   `{ installedVersion, source, spec }`; a missing profile or manifest entry
 *   reads as a `link` install with no spec. The route keeps `spec` server-side.
 */
function readStatus(profile) {
  const spec = profile === null ? undefined : dependencySpec(manifestOf(profile))
  const source = profile === null ? 'link' : sourceOf(spec)
  return { installedVersion: PACKAGE_VERSION, source, spec }
}

/**
 * Read the request body as UTF-8, refusing anything over 1024 bytes.
 *
 * Args:
 *   req: the HTTP request stream.
 * Returns:
 *   The body text.
 * Raises:
 *   Error when the body grows past the limit.
 */
async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new Error('The request body is too large.')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Ask the npm registry for the newest published version, then the mirror.
 *
 * Args:
 *   fetchImpl: fetch implementation; tests replace it to stay offline.
 * Returns:
 *   `{ latestVersion, registry, error }`. A failure in both registries keeps
 *   `latestVersion` and `registry` null and sets `error`.
 */
async function checkRegistries(fetchImpl) {
  let reason = 'the request failed'
  for (const registry of REGISTRIES) {
    try {
      const response = await fetchImpl(`${registry}${PACKAGE_NAME}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const latest = (await response.json())?.['dist-tags']?.latest
      if (typeof latest !== 'string' || !VERSION_PATTERN.test(latest)) {
        throw new Error('the registry returned no version')
      }
      return { latestVersion: latest, registry, error: null }
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
    }
  }
  return {
    latestVersion: null,
    registry: null,
    error: `No npm registry answered with a version: ${reason}`,
  }
}

/**
 * Read the newest version from the official GitHub repository.
 *
 * Args:
 *   target: `{ repo, ref }` from `githubTarget`; the repo must be official.
 *   fetchImpl: fetch implementation; tests replace it to stay offline.
 * Returns:
 *   `{ latestVersion, registry, error }`. A failure keeps the first two null
 *   and sets `error`.
 */
async function checkGithub(target, fetchImpl) {
  try {
    const response = await fetchImpl(`${RAW_BASE}${target.repo}/${target.ref ?? 'HEAD'}/package.json`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const latest = (await response.json())?.version
    if (typeof latest !== 'string' || !VERSION_PATTERN.test(latest)) {
      throw new Error('the repository returned no version')
    }
    return { latestVersion: latest, registry: RAW_BASE, error: null }
  } catch (error) {
    return {
      latestVersion: null,
      registry: null,
      error: `The repository did not answer with a version: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run one pnpm command in the profile.
 *
 * Args:
 *   profile: the profile root, or null when there is nowhere to install.
 *   args: the pnpm arguments, built by the caller; no request text reaches
 *     here unless it already passed the version check or is the manifest spec.
 * Returns:
 *   A promise that resolves on exit code 0. It rejects with an Error on a
 *   missing profile, spawn failure, non-zero exit, or a 300 s timeout. The
 *   message carries the stderr tail when pnpm wrote one.
 */
function runPnpm(profile, args) {
  if (profile === null) {
    return Promise.reject(new Error('This copy has no profile directory to install into.'))
  }
  return new Promise((resolve, reject) => {
    // Windows cannot start the pnpm `.cmd` shim without a command processor,
    // so keep `shell: false` and hand cmd.exe the fixed argument list.
    const [command, prefix] =
      process.platform === 'win32'
        ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm']]
        : ['pnpm', []]
    let child
    try {
      child = spawn(command, [...prefix, ...args], {
        cwd: profile,
        shell: false,
        windowsHide: true,
      })
    } catch (error) {
      reject(error)
      return
    }

    let settled = false
    let stderr = ''
    let timer
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error === undefined) resolve()
      else reject(error)
    }

    timer = setTimeout(() => {
      // shortcut: the kill reaches cmd.exe only, upgrade to a tree kill if
      // orphaned pnpm children keep running.
      child.kill()
      finish(new Error(`pnpm did not finish within ${INSTALL_TIMEOUT_MS / 1000} s.`))
    }, INSTALL_TIMEOUT_MS)
    child.stderr?.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-500)
    })
    child.on('error', (error) => finish(new Error(`Could not start pnpm: ${error.message}`)))
    child.on('close', (code) => {
      if (code === 0) {
        finish()
        return
      }
      const tail = stderr.trim()
      finish(new Error(tail === '' ? `pnpm exited with code ${code}.` : tail))
    })
  })
}

/**
 * Install one exact registry version, pinned in the manifest.
 *
 * Args:
 *   profile: the profile root.
 *   version: a string already checked against `1.2.3`.
 * Returns:
 *   The promise from `runPnpm`.
 */
function installVersion(profile, version) {
  return runPnpm(profile, ['add', `${PACKAGE_NAME}@${version}`, '--save-exact'])
}

/**
 * Re-resolve the existing GitHub spec to the newest commit of its ref.
 *
 * Args:
 *   profile: the profile root.
 *   spec: the manifest spec, unchanged.
 * Returns:
 *   The promise from `runPnpm`.
 */
function installGithub(profile, spec) {
  return runPnpm(profile, ['add', spec])
}

/**
 * Read the version that landed in the profile, if pnpm wrote one.
 *
 * Args:
 *   profile: the profile root, or null.
 * Returns:
 *   A `major.minor.patch` string, or null when the file is absent or unreadable.
 */
function installedOnDisk(profile) {
  if (profile === null) return null
  const version = manifestOf(join(profile, 'node_modules', PACKAGE_NAME))?.version
  return typeof version === 'string' && VERSION_PATTERN.test(version) ? version : null
}

/** Turn an unexpected throw into the shared failure shape. */
function failedCheck(error) {
  return { latestVersion: null, registry: null, error: error instanceof Error ? error.message : String(error) }
}

/**
 * Compare two plain `major.minor.patch` versions.
 *
 * Args:
 *   left: a version string.
 *   right: a version string.
 * Returns:
 *   A positive number when `left` is newer, a negative number when `right` is,
 *   and 0 when they match or either one is not plain `major.minor.patch`.
 */
function compareVersions(left, right) {
  if (!VERSION_PATTERN.test(String(left ?? '')) || !VERSION_PATTERN.test(String(right ?? ''))) return 0
  const first = left.split('.').map(Number)
  const second = right.split('.').map(Number)
  for (let at = 0; at < 3; at += 1) {
    if (first[at] !== second[at]) return first[at] - second[at]
  }
  return 0
}

/**
 * Choose the newest version across the two channels.
 *
 * Args:
 *   current: `{ source }` for the installed copy.
 *   npm: `{ latestVersion, registry, error }`.
 *   github: the same shape.
 * Returns:
 *   `{ latestVersion, channel, registry, error }`. A tie stays on the installed
 *   channel so an update does not change the spec for nothing. When both
 *   channels fail, `error` carries both messages.
 */
function pickNewest(current, npm, github) {
  if (npm.latestVersion === null && github.latestVersion === null) {
    const reasons = [npm.error, github.error].filter((text) => typeof text === 'string')
    return {
      latestVersion: null,
      channel: null,
      registry: null,
      error: reasons.length === 0 ? 'No source answered with a version.' : reasons.join(' '),
    }
  }
  const order = compareVersions(github.latestVersion, npm.latestVersion)
  const useGithub =
    github.latestVersion !== null &&
    (npm.latestVersion === null || order > 0 || (order === 0 && current.source === 'github'))
  const winner = useGithub ? github : npm
  return {
    latestVersion: winner.latestVersion,
    channel: useGithub ? 'github' : 'npm',
    registry: winner.registry,
    error: null,
  }
}

/**
 * Build the update route handler.
 *
 * `webServer.register` adds no auth fence, so the connection service decides
 * first: a missing cookie is 401 and a bad Host or Origin is 403. The method
 * check follows.
 *
 * GET replies 200 with `{ installedVersion, source, latestVersion, channel,
 * registry, error, github }`. `latestVersion` is the higher of the npm and
 * official-repository versions, and `channel` says which one answered
 * (`npm` or `github`). `github` is `{ repo, ref, pinned, official }` for a
 * GitHub install and null otherwise. A link install, a pinned ref, and a fork
 * return nulls. A failed check keeps the 200 and sets `error`.
 *
 * POST replies 200 with `{ installedVersion }`, 400 `{ error }` for a body
 * that is not JSON or, on the npm channel, carries no `1.2.3` version. It
 * replies 409 `{ error }` for a source that cannot update or a run already in
 * progress, and 500 `{ error }` when pnpm fails, exits non-zero, or times out.
 * `channel` in the body picks the install source; a missing or unknown value
 * keeps the installed source.
 *
 * Args:
 *   options: `connection` is required. Every other key replaces the real work
 *     so tests stay offline and never run pnpm.
 *   options.connection: the host connection service.
 *   options.profile: the profile root holding `package.json`; null reads as a
 *     `link` install. Defaults to the root found above this module.
 *   options.status: returns `{ installedVersion, source, spec }`.
 *   options.fetchImpl: fetch used for the registry or repository check.
 *   options.installNpm: installs one registry version.
 *   options.installGit: re-resolves the GitHub spec.
 *   options.readDisk: reads the version that landed in the profile.
 * Returns:
 *   `(req, res) => Promise<void>`, which writes the reply itself. No promise
 *   rejection leaves the handler.
 */
export function createUpdateHandler({
  connection,
  profile = profileRoot(),
  status = () => readStatus(profile),
  fetchImpl = fetch,
  installNpm = (version) => installVersion(profile, version),
  installGit = (spec) => installGithub(profile, spec),
  readDisk = () => installedOnDisk(profile),
} = {}) {
  // One cache per route: a module-wide cache would leak between test handlers
  // and keep a stale answer for the next 60 s after an install.
  let cached
  let busy = false

  function githubInfo(current) {
    if (current.source !== 'github') return null
    const target = githubTarget(current.spec)
    if (target === null) return { repo: null, ref: null, pinned: false, official: false }
    return {
      repo: target.repo,
      ref: target.ref,
      pinned: target.pinned,
      official: target.repo === OFFICIAL_REPO,
    }
  }

  async function releaseState(force, current) {
    if (!force && cached !== undefined && Date.now() - cached.at < UPDATE_CACHE_MS) {
      return cached.value
    }
    const target = current.source === 'github' ? githubTarget(current.spec) : null
    // A link copy, a pinned ref, and a fork are deliberate choices: none moves.
    if (
      (current.source !== 'npm' && current.source !== 'github') ||
      (current.source === 'github' && (target === null || target.repo !== OFFICIAL_REPO || target.pinned))
    ) {
      const value = { latestVersion: null, channel: null, registry: null, error: null }
      cached = { at: Date.now(), value }
      return value
    }
    const githubSide = current.source === 'github' ? target : { repo: OFFICIAL_REPO, ref: null }
    const [npm, github] = await Promise.all([
      checkRegistries(fetchImpl).catch(failedCheck),
      checkGithub(githubSide, fetchImpl).catch(failedCheck),
    ])
    const value = pickNewest(current, npm, github)
    cached = { at: Date.now(), value }
    return value
  }

  return async function updateRoute(req, res) {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) {
      res.writeHead(rejection)
      res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }

    if (req.method === 'GET') {
      const current = status()
      const release = await releaseState(/[?&]force=1(?:&|$)/.test(req.url ?? ''), current)
      const { spec, ...visible } = current
      sendJson(res, 200, { ...visible, ...release, github: githubInfo(current) })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' })
      return
    }

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      return
    }
    const current = status()
    if (current.source !== 'npm' && current.source !== 'github') {
      sendJson(res, 409, { error: 'This copy cannot be updated from this page.' })
      return
    }
    const target = current.source === 'github' ? githubTarget(current.spec) : null
    if (current.source === 'github' && (target === null || target.repo !== OFFICIAL_REPO)) {
      sendJson(res, 409, { error: 'This copy comes from another repository.' })
      return
    }
    if (current.source === 'github' && target.pinned) {
      sendJson(res, 409, { error: 'This copy is pinned to an exact ref.' })
      return
    }
    const channel = body?.channel === 'github' || body?.channel === 'npm' ? body.channel : current.source
    if (channel === 'npm') {
      const version = body?.version
      if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
        sendJson(res, 400, { error: 'The version must look like 1.2.3.' })
        return
      }
      if (busy) {
        sendJson(res, 409, { error: 'An update is already running.' })
        return
      }
      busy = true
      try {
        await installNpm(version)
        sendJson(res, 200, { installedVersion: version })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      } finally {
        busy = false
      }
      return
    }
    if (busy) {
      sendJson(res, 409, { error: 'An update is already running.' })
      return
    }
    busy = true
    try {
      await installGit(current.source === 'github' ? current.spec : GITHUB_SPEC)
      const requested = typeof body?.version === 'string' && VERSION_PATTERN.test(body.version) ? body.version : null
      sendJson(res, 200, { installedVersion: readDisk() ?? requested ?? current.installedVersion })
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      busy = false
    }
  }
}

/**
 * @param config - `section` is an optional overlay text; a missing value uses
 * the bundled `assets/section.md`.
 */
export function apply(ctx, config) {

  const section = config?.section
  if (typeof section !== 'string' || section.trim() === '') {
    throw new Error('dsh-nerd-mode needs a non-empty string `section`')
  }

  ctx.sessionProjections.register(projection)

  ctx.effect(
    () => ctx.on('agent/inbox/claimed', ({ agent, message }) => {
      directStudyPlusBySession.set(agent.session, directStudyPlusId(message))
    }),
    'dsh-nerd-mode: study-plus claim',
  )

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION,
        order: SECTION_ORDER,
        text: (context) => {
          if (context.agent === undefined) return ''
          if (!ctx.sessionProjections.stateOf(context.agent.session, KEY).active) return ''
          const session = context.agent.session
          const invocationId = studyPlusInvocation(session)
          if (invocationId === undefined) return section
          return section + studyPlusSettings(config ?? {}, session, invocationId)
        },
      }),
    'dsh-nerd-mode: section',
  )

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: COMMAND,
      description: 'Turn Nerd Mode on or off for this conversation',
      input: { hint: '[on|off]' },
      handler: ({ agent, rawInput }) => {
        const arg = rawInput.trim().toLowerCase()
        const active = ctx.sessionProjections.stateOf(agent.session, KEY).active

        if (arg === 'off') {
          return { kind: 'success', text: active ? 'Nerd Mode off.' : 'Nerd Mode is already off.' }
        }
        if (arg !== '' && arg !== 'on') {
          return { kind: 'error', text: `Unknown argument "${arg}". Use /nerd-mode on or /nerd-mode off.` }
        }
        return {
          kind: 'success',
          text: active ? 'Nerd Mode is already on.' : 'Nerd Mode on. /study guides a concept or a task.',
        }
      },
    })
  })

  // The web server is optional: a host without it still loads the switch and
  // the prompt section, and the panel shows its failure line.
  ctx.inject(['webServer', 'connection'], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'exact',
          path: STUDY_SESSIONS_PATH,
          handler: createStudySessionsHandler({ connection: webCtx.connection }),
        }),
      'dsh-nerd-mode: study sessions route',
    )

    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'exact',
          path: UPDATE_PATH,
          handler: createUpdateHandler({ connection: webCtx.connection }),
        }),
      'dsh-nerd-mode: update route',
    )
  })
}
