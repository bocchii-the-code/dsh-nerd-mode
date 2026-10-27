import test from 'node:test'
import assert from 'node:assert/strict'
import { COMMAND, fold, init } from '../lib/fold.js'

const run = (args, name = COMMAND) => ({
  type: 'command/run',
  data: { name, commandId: 'c1', args },
})
const done = (kind) => ({ type: 'command/done', data: { commandId: 'c1', kind } })
const other = (type) => ({ type, data: {} })

test('starts off', () => {
  assert.deepEqual(init(), { active: false, running: null })
})

test('a bare command turns it on', () => {
  const state = fold(fold(init(), run(undefined)), done('success'))
  assert.equal(state.active, true)
})

test('off turns it off', () => {
  const on = fold(fold(init(), run('on')), done('success'))
  const off = fold(fold(on, run('off')), done('success'))
  assert.equal(off.active, false)
})

test('a failed command changes nothing', () => {
  const state = fold(fold(init(), run('on')), done('error'))
  assert.equal(state.active, false)
})

test('an unrelated command is ignored', () => {
  const state = fold(fold(init(), run('on', 'plan')), done('success'))
  assert.equal(state.active, false)
})

test('unrelated events are ignored', () => {
  const state = init()
  assert.equal(fold(state, other('session/update')), state)
})

test('the done event must match the running command', () => {
  const state = fold(init(), run('on'))
  const stale = fold(state, { type: 'command/done', data: { commandId: 'c2', kind: 'success' } })
  assert.equal(stale.active, false)
})
