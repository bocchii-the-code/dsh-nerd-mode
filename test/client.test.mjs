import test from 'node:test'
import assert from 'node:assert/strict'

// client.js calls window.__ModuleLoader__.load at import time.
let captured
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }
await import('../client.js')

// Only the hooks the component calls, with no re-render.
const React = {
  createElement(type, props, ...children) {
    return { type, props: { ...props, children } }
  },
  useEffect() {},
  useState(initial) {
    return [initial, () => {}]
  },
}

const client = captured.factory((id) => {
  if (id === 'react') return React
  throw new Error(`unexpected module: ${id}`)
})

function mount() {
  const registers = []
  const executed = []
  const ctx = {
    slots: {
      inject(_name, fn) {
        return fn()
      },
      register(options, component) {
        registers.push({ options, component })
        return () => {}
      },
    },
    remote: {
      commands: {
        async execute(...args) {
          executed.push(args)
          return { ok: true, value: {} }
        },
      },
    },
  }
  client.apply(ctx)
  return { registers, executed }
}

function render(active) {
  const { registers, executed } = mount()
  const injected = registers[0].options.inject('session-1')
  let key
  const tree = registers[0].component({
    useProjection: (name) => {
      key = name
      return { active }
    },
    ...injected,
  })
  return { tree, key, executed }
}

test('registers one toggle in the composer bar', () => {
  const { registers } = mount()
  assert.equal(registers.length, 1)
  const { options } = registers[0]
  assert.equal(options.name, 'conversation.input.left')
  assert.equal(options.id, 'nerd-mode')
  assert.equal(options.order, -1)
})

test('renders an on switch labelled Nerd mode', () => {
  const { tree, key } = render(true)
  assert.equal(key, 'studyMode')
  assert.equal(tree.props.role, 'switch')
  assert.equal(tree.props['aria-checked'], true)
  assert.equal(tree.props['data-state'], 'on')
  const label = tree.props.children.find((child) => child?.type === 'span')
  assert.deepEqual(label.props.children, ['Nerd mode'])
})

test('renders a dim pill when off', () => {
  const { tree } = render(false)
  assert.equal(tree.props['aria-checked'], false)
  assert.equal(tree.props['data-state'], 'off')
})

test('click sends the opposite command to this session', async () => {
  const { tree, executed } = render(true)
  await tree.props.onClick()
  assert.deepEqual(executed, [['session-1', '/nerd-mode off', []]])
})

test('click turns the mode on when off', async () => {
  const { tree, executed } = render(false)
  await tree.props.onClick()
  assert.deepEqual(executed, [['session-1', '/nerd-mode on', []]])
})
