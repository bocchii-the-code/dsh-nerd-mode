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

export const name = 'dsh-nerd-mode'
export const PACKAGE_NAME = 'dsh-nerd-mode'
export const inject = ['systemPrompt', 'sessionProjections']

const SECTION = 'study:policy'
// Between PLAN_POLICY (500) and TEAM_POLICY (600).
const SECTION_ORDER = 550

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
    () =>
      ctx.systemPrompt.section({
        name: SECTION,
        order: SECTION_ORDER,
        text: (context) => {
          if (context.agent === undefined) return ''
          return ctx.sessionProjections.stateOf(context.agent.session, KEY).active ? section : ''
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
