import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { Config, apply } = await import('../lib/index.js')
const SETTINGS = {
  recallSessionEnabled: false,
  unseenQuestionCount: 3,
  unseenQuestionType: 'short-answer',
}

function makeSession(events = [], messages = []) {
  return {
    seq: events.length,
    eventAt: (seq) => events[seq],
    // The host returns the full surface history here, not just the current turn.
    deriveMessages: () => messages,
  }
}

function makeCtx(active = true) {
  const handlers = new Map()
  let section
  const ctx = {
    sessionProjections: {
      register() {},
      stateOf: () => ({ active }),
    },
    systemPrompt: {
      section(value) {
        section = value
      },
    },
    on(name, handler) {
      handlers.set(name, handler)
      return () => handlers.delete(name)
    },
    effect(register) {
      register()
    },
    inject(_names, register) {
      register({ commands: { register() {} } })
    },
  }
  return { ctx, handlers, section: () => section }
}

function promptFor({ settings = SETTINGS, events = [], messages = [], active = true } = {}) {
  const config = Config({ section: 'base Nerd Mode policy', ...settings })
  const { ctx, section } = makeCtx(active)

  apply(ctx, config)
  const session = makeSession(events, messages)
  return section().text({ agent: { session } })
}

function skillInvocation(name = 'study-plus') {
  return { id: `${name}-invocation`, source: { kind: 'skill-invocation', name } }
}

function userMessage(text, source = { kind: 'user' }) {
  return { source, content: [{ type: 'text', text }] }
}

function invocationEvents(name, request = '/study-plus') {
  const invocation = skillInvocation(name)
  return [
    { type: 'turn/start', data: {} },
    // Real sessions store user message fields directly in `data`.
    { type: 'user/message', data: userMessage(request) },
    { type: 'tool/call', data: { name: 'skill', callId: name, arguments: JSON.stringify({ name }) } },
    { type: 'tool/result', data: { message: { isError: false, source: { callId: name } } } },
    { type: 'user/message', data: invocation },
  ]
}

function ptcInvocationEvents(name = 'study-plus') {
  const subCallId = 'root-1:ptc:1'
  return [
    { type: 'turn/start', data: {} },
    { type: 'user/message', data: userMessage('start a tracked session') },
    { type: 'tool/call', data: { name: 'run_code', callId: 'root-1', arguments: '{}' } },
    { type: 'tool/ptc-dispatch-start', data: { rootCallId: 'root-1', subCallId, name: 'skill', arguments: { name } } },
    { type: 'tool/ptc-dispatch', data: { rootCallId: 'root-1', subCallId, name: 'skill', arguments: { name }, isError: false, content: [] } },
    { type: 'tool/result', data: { message: { isError: false, source: { callId: 'root-1' } } } },
  ]
}

test('config validates the required section and volatile setting defaults', () => {
  assert.throws(() => Config({}), /section.*missing|required/i)
  assert.throws(() => Config({ section: '' }), /section.*match/i)
  assert.throws(() => Config({ section: '  \n  ' }), /section.*match/i)

  const config = Config({ section: ' policy ' })
  assert.equal(config.section, ' policy ')
  assert.equal(config.recallSessionEnabled.get(), false)
  assert.equal(config.unseenQuestionCount.get(), 3)
  assert.equal(config.unseenQuestionType.get(), 'short-answer')
})

test('config rejects invalid setting values and accepts count endpoints', () => {
  for (const unseenQuestionCount of [-1, 11, 1.5, Number.NaN]) {
    assert.throws(() => Config({ section: 'policy', unseenQuestionCount }))
  }
  for (const unseenQuestionType of ['essay', '']) {
    assert.throws(() => Config({ section: 'policy', unseenQuestionType }))
  }
  assert.throws(() => Config({ section: 'policy', recallSessionEnabled: 1 }))
  // JSON null means unset, so it takes the default like an omitted key.
  assert.equal(Config({ section: 'policy', unseenQuestionType: null }).unseenQuestionType.get(), 'short-answer')

  for (const unseenQuestionCount of [0, 10]) {
    assert.equal(Config({ section: 'policy', unseenQuestionCount }).unseenQuestionCount.get(), unseenQuestionCount)
  }
  for (const unseenQuestionType of ['short-answer', 'multiple-choice', 'mixed']) {
    assert.equal(Config({ section: 'policy', unseenQuestionType }).unseenQuestionType.get(), unseenQuestionType)
  }
})

test('prompt keeps the section unchanged without a completed study-plus skill load', () => {
  const ordinary = invocationEvents('study', '/study')
  const failed = invocationEvents('study-plus')
  failed[3].data.message.isError = true
  const plain = [
    { type: 'turn/start', data: {} },
    { type: 'user/message', data: userMessage('/study-plus') },
  ]

  assert.equal(promptFor({ events: ordinary }), 'base Nerd Mode policy')
  assert.equal(promptFor({ events: failed }), 'base Nerd Mode policy')
  assert.equal(promptFor({ events: plain }), 'base Nerd Mode policy')
  assert.equal(promptFor({ active: false, events: invocationEvents('study-plus') }), '')
})

test('prompt reads a step with ordinary user messages and a tool result', () => {
  const events = [
    { type: 'turn/start', data: {} },
    { type: 'user/message', data: userMessage('teach me TypeScript') },
    { type: 'tool/call', data: { name: 'pwsh', callId: 'call-1', arguments: '{}' } },
    { type: 'tool/result', data: { message: { isError: false, source: { callId: 'call-1' } } } },
  ]

  assert.equal(promptFor({ events }), 'base Nerd Mode policy')
})

test('prompt tolerates partial events from a resumed or seeded log', () => {
  const events = [
    { type: 'turn/start', data: {} },
    { type: 'user/message', data: {} },
    { type: 'tool/call', data: {} },
    { type: 'tool/result', data: {} },
  ]

  assert.equal(promptFor({ events }), 'base Nerd Mode policy')
})

test('prompt reads active settings for a completed study-plus invocation', () => {
  const events = invocationEvents('study-plus')
  const expectedInstructions = [
    '',
    '',
    'Study-plus profile defaults for this tracked session:',
    '- Recall Session: enabled.',
    '- Post-lecture questions: 8; type: mixed.',
    'Apply these defaults only during tracked study-plus sessions. Ignore them for ordinary study and all other requests.',
    'An explicit preference in the current /study-plus request overrides its profile default for this session and does not update the profile.',
  ].join('\n')

  assert.equal(
    promptFor({
      settings: { recallSessionEnabled: true, unseenQuestionCount: 8, unseenQuestionType: 'mixed' },
      events,
    }),
    `base Nerd Mode policy${expectedInstructions}`,
  )
  assert.equal(
    promptFor({ settings: { recallSessionEnabled: false, unseenQuestionCount: 0 }, events }),
    [
      'base Nerd Mode policy',
      '',
      'Study-plus profile defaults for this tracked session:',
      '- Recall Session: disabled.',
      '- Post-lecture questions: 0; type: short-answer.',
      'Apply these defaults only during tracked study-plus sessions. Ignore them for ordinary study and all other requests.',
      'An explicit preference in the current /study-plus request overrides its profile default for this session and does not update the profile.',
    ].join('\n'),
  )
})

test('prompt recognizes a study-plus load dispatched through run_code', () => {
  assert.match(
    promptFor({ events: ptcInvocationEvents('study-plus') }),
    /Study-plus profile defaults for this tracked session/,
  )
  assert.equal(promptFor({ events: ptcInvocationEvents('study') }), 'base Nerd Mode policy')

  const failed = ptcInvocationEvents('study-plus')
  failed[4].data.isError = true
  assert.equal(promptFor({ events: failed }), 'base Nerd Mode policy')
})

test('a PTC study-plus load keeps the defaults on a later turn', () => {
  const { ctx, section } = makeCtx()
  apply(ctx, Config({ section: 'base Nerd Mode policy' }))
  const session = makeSession(ptcInvocationEvents('study-plus'))

  assert.match(section().text({ agent: { session } }), /Study-plus profile defaults/)
  // The next turn has no dispatch event of its own; the cached id keeps the defaults.
  session.seq = 0
  assert.match(section().text({ agent: { session } }), /Study-plus profile defaults/)
})

test('claim handler records the direct study-plus message and survives other claims', () => {
  const { ctx, handlers, section } = makeCtx()
  apply(ctx, Config({ section: 'base Nerd Mode policy' }))
  const claim = handlers.get('agent/inbox/claimed')
  assert.equal(typeof claim, 'function')

  const session = makeSession()
  const messages = [
    { id: 'msg-1', source: { kind: 'user' }, content: [{ type: 'text', text: '/study-plus demo' }] },
    { id: 'msg-2', source: { kind: 'user' }, content: [{ type: 'text', text: '/study demo' }] },
    { id: 'msg-3', source: { kind: 'tool' }, content: [] },
  ]
  for (const message of messages) {
    assert.doesNotThrow(() => claim({ agent: { session }, message }))
  }

  claim({ agent: { session }, message: messages[0] })
  assert.match(section().text({ agent: { session } }), /Study-plus profile defaults for this tracked session/)
})

test('a later turn keeps the defaults while the skill invocation stays in history', () => {
  const { ctx, handlers, section } = makeCtx()
  apply(ctx, Config({ section: 'base Nerd Mode policy' }))
  const claim = handlers.get('agent/inbox/claimed')
  const session = makeSession([], [skillInvocation('study-plus')])

  claim({
    agent: { session },
    message: { id: 'msg-2', source: { kind: 'user' }, content: [{ type: 'text', text: 'continue' }] },
  })

  assert.match(section().text({ agent: { session } }), /Study-plus profile defaults for this tracked session/)
})

test('study-plus instructions keep request overrides, recall effects, and slot retry rules', async () => {
  const skill = await readFile(new URL('../skills/study-plus/SKILL.md', import.meta.url), 'utf8')
  assert.match(skill, /current `\/study-plus` request's explicit preference when present/)
  assert.match(skill, /Do not change learner knowledge, tracker state, or the session log because of this activity/)
  assert.match(skill, /When the configured count is zero, skip unseen questions\. A passed Teach-back alone is sufficient to pass/)
  assert.match(skill, /`ceil\(2 × slot count \/ 3\)` correct slots/)
  assert.match(skill, /four options with exactly one correct answer/)
  assert.match(skill, /choose short-answer or multiple-choice independently at random for each planned slot/)
  assert.match(skill, /similar question in the same slot/)
  assert.match(skill, /Keep the original miss recorded even if the learner answers the similar question correctly/)
  assert.doesNotMatch(skill, /Ask three unseen questions|three questions were never asked/)
})
