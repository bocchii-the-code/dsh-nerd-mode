/**
 * Nerd Mode: a per-session switch. While it is on, one prompt section joins
 * every request and the `study` skill becomes the default answer shape. State
 * folds from the session log, so it survives compaction, resume, and fork. The
 * tool set never changes.
 *
 * The section registers at the profile level, not inside a preset, so it
 * reaches every agent in every preset. See docs/adr/0008.
 */

import { COMMAND, KEY, fold, init } from './fold.js'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-nerd-mode'
export const PACKAGE_NAME = 'dsh-nerd-mode'
export const inject = ['systemPrompt', 'sessionProjections']

export const Config = z.object({
  section: z.string().pattern(/\S/).required(),
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
const studyPlusDefaultsBySession = new WeakMap()
const directStudyPlusBySession = new WeakMap()
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

  // The host returns the full surface history here, not just this turn. See docs/agents/dsh-session-api.md.
  const invocation = session.deriveMessages().findLast((message) => message.source?.kind === 'skill-invocation')
  if (invocation?.source.name === 'study-plus') return invocation.id

  const completedCalls = new Set()
  let loadedId
  let directId
  let skillCall
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const event = session.eventAt(seq)
    if (event?.type === 'turn/start') break
    if (event?.type === 'tool/result') {
      if (!event.data.message.isError) completedCalls.add(event.data.message.source.callId)
    } else if (event?.type === 'tool/call' && event.data.name === 'skill') {
      try {
        if (JSON.parse(event.data.arguments).name === 'study-plus') skillCall = event.data.callId
      } catch {}
    } else if (event?.type === 'user/message') {
      const message = event.data.message
      if (message.source?.kind === 'skill-invocation') {
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

/**
 * @param config - `section` is the overlay text, required and non-empty.
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
}
