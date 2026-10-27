/**
 * The Nerd mode state machine, kept free of host imports so it can be tested
 * with plain node. State folds the session log: `command/run` records the
 * request, `command/done` commits it. Nothing else is written, because an
 * unknown stored event type stops a session from reopening.
 */

// Stored state keeps `studyMode`; renaming it would orphan every session that
// already holds a value. See ADR 0009.
export const KEY = 'studyMode'
export const COMMAND = 'nerd-mode'

/** @returns {{ active: boolean, running: { commandId: string, wanted: boolean } | null }} */
export function init() {
  return { active: false, running: null }
}

/**
 * Fold one session event into the state.
 * @param state - current state; never mutated
 * @param event - a session log event
 * @returns the next state, or the same object when the event is unrelated
 */
export function fold(state, event) {
  const data = event?.data

  if (event?.type === 'command/run' && data?.name === COMMAND) {
    // A bare /nerd-mode means on, matching /plan.
    const wanted = (data.args ?? 'on').trim().toLowerCase() !== 'off'
    return { ...state, running: { commandId: data.commandId, wanted } }
  }

  if (event?.type === 'command/done' && data?.commandId === state.running?.commandId) {
    const { wanted } = state.running
    return { ...state, active: data.kind === 'success' ? wanted : state.active, running: null }
  }

  return state
}
