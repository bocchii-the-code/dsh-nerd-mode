import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const profileRequire = createRequire(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'desktop', 'package.json'))
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/schemastery') {
      return nextResolve(pathToFileURL(profileRequire.resolve(specifier)).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { Config, apply } = await import('../lib/index.js')
const SETTINGS = {
  recallSessionEnabled: false,
  unseenQuestionCount: 3,
  unseenQuestionType: 'short-answer',
}

function makeSession(events = []) {
  return {
    seq: events.length,
    eventAt: (seq) => events[seq],
    deriveMessages: () => [],
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

function promptFor({ settings = SETTINGS, events = [], active = true } = {}) {
  const config = Config({ section: 'base Nerd Mode policy', ...settings })
  const { ctx, section } = makeCtx(active)

  apply(ctx, config)
  const session = makeSession(events)
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
    { type: 'user/message', data: { message: userMessage(request) } },
    { type: 'tool/call', data: { name: 'skill', callId: name, arguments: JSON.stringify({ name }) } },
    { type: 'tool/result', data: { message: { isError: false, source: { callId: name } } } },
    { type: 'user/message', data: { message: invocation } },
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
    { type: 'user/message', data: { message: userMessage('/study-plus') } },
  ]

  assert.equal(promptFor({ events: ordinary }), 'base Nerd Mode policy')
  assert.equal(promptFor({ events: failed }), 'base Nerd Mode policy')
  assert.equal(promptFor({ events: plain }), 'base Nerd Mode policy')
  assert.equal(promptFor({ active: false, events: invocationEvents('study-plus') }), '')
})

test('prompt reads active settings for a completed study-plus invocation', () => {
  const events = invocationEvents('study-plus')
  const expectedInstructions = [
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
      'Study-plus profile defaults for this tracked session:',
      '- Recall Session: disabled.',
      '- Post-lecture questions: 0; type: short-answer.',
      'Apply these defaults only during tracked study-plus sessions. Ignore them for ordinary study and all other requests.',
      'An explicit preference in the current /study-plus request overrides its profile default for this session and does not update the profile.',
    ].join('\n'),
  )
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
