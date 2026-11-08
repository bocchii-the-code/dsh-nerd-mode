/**
 * Nerd Mode: a per-session switch. While it is on, one prompt section joins
 * every request and the `study` skill becomes the default answer shape. State
 * folds from the session log, so it survives compaction, resume, and fork. The
 * tool set never changes.
 *
 * The section registers at the profile level, not inside a preset, so it
 * reaches every agent in every preset. See docs/adr/0008.
 */

import { readFileSync } from 'node:fs'
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
  })
}
