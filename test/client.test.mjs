import test from 'node:test'
import assert from 'node:assert/strict'

// client.js calls window.__ModuleLoader__.load at import time.
let captured
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }
await import('../client.js')

const FakeToast = function Toast() {}
let hookStates = []
let hookIndex = 0

// Enough of React to run the component and replay its hook state.
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    return { type, props: { ...props, children } }
  },
  useEffect() {},
  useState(initial) {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = initial
    return [
      hookStates[index],
      (next) => {
        hookStates[index] = typeof next === 'function' ? next(hookStates[index]) : next
      },
    ]
  },
}

const client = captured.factory((id) => {
  if (id === 'react') return React
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Toast: FakeToast }
  throw new Error(`unexpected module: ${id}`)
})

function mount(executeImpl) {
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
          return executeImpl ? executeImpl(...args) : { ok: true, value: {} }
        },
      },
    },
  }
  client.apply(ctx)
  return { registers, executed }
}

function render(active, executeImpl) {
  const { registers, executed } = mount(executeImpl)
  const injected = registers[0].options.inject('session-1')
  const component = registers[0].component
  let projectionKey

  const draw = (value) => {
    hookIndex = 0
    return component({
      useProjection: (name) => {
        projectionKey = name
        return { active: value }
      },
      ...injected,
    })
  }

  hookStates = []
  const tree = draw(active)
  return {
    tree,
    executed,
    projectionKey: () => projectionKey,
    rerender: (value = active) => draw(value),
  }
}

const buttonOf = (tree) => tree.props.children.find((child) => child?.type === 'button')
const toastOf = (tree) => tree.props.children.find((child) => child?.type === FakeToast)

test('registers one toggle in the composer bar', () => {
  assert.ok(client.inject.includes('remote'))
  assert.ok(client.inject.includes('remote.commands'))
  const { registers } = mount()
  assert.equal(registers.length, 1)
  const { options } = registers[0]
  assert.equal(options.name, 'conversation.input.left')
  assert.equal(options.id, 'nerd-mode')
  assert.equal(options.order, -1)
})

test('renders an on switch labelled Nerd Mode', () => {
  const view = render(true)
  const button = buttonOf(view.tree)
  assert.equal(view.projectionKey(), 'studyMode')
  assert.equal(button.props.role, 'switch')
  assert.equal(button.props['aria-checked'], true)
  assert.equal(button.props['data-state'], 'on')
  const label = button.props.children.find((child) => child?.type === 'span')
  assert.deepEqual(label.props.children, ['Nerd Mode'])
})

test('renders a dim pill when off', () => {
  const view = render(false)
  const button = buttonOf(view.tree)
  assert.equal(button.props['aria-checked'], false)
  assert.equal(button.props['data-state'], 'off')
})

test('click sends the opposite command to this session', async () => {
  const view = render(true)
  await buttonOf(view.tree).props.onClick()
  assert.deepEqual(view.executed, [['session-1', '/nerd-mode off', []]])
  assert.equal(toastOf(view.tree), undefined)
})

test('an unknown command shows a toast and keeps the pill state', async () => {
  const view = render(false, async () => ({ ok: true }))
  await buttonOf(view.tree).props.onClick()

  const after = view.rerender(false)
  const button = buttonOf(after)
  const toast = toastOf(after)
  assert.equal(button.props['data-state'], 'off')
  assert.match(button.props.title, /not available in this build/)
  assert.match(toast.props.text, /not available in this build/)
})

test('a remote failure shows its message in the toast', async () => {
  const view = render(false, async () => ({ ok: false, error: { message: 'the host is offline' } }))
  await buttonOf(view.tree).props.onClick()

  const toast = toastOf(view.rerender(false))
  assert.match(toast.props.text, /the host is offline/)
})

test('dismissing the toast keeps the tooltip text', async () => {
  const view = render(false, async () => ({ ok: true }))
  await buttonOf(view.tree).props.onClick()

  const after = view.rerender(false)
  toastOf(after).props.onDone()
  const later = view.rerender(false)
  assert.equal(toastOf(later), undefined)
  assert.match(buttonOf(later).props.title, /not available in this build/)
})
