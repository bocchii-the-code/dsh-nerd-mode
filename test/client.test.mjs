import test from 'node:test'
import assert from 'node:assert/strict'

// client.js calls window.__ModuleLoader__.load at import time.
let captured
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }
await import('../client.js')

const FakeToast = function Toast() {}
let hookInstances = new Map()
let activeHooks
let hookIndex = 0
let externalSubscriptions = 0

// Enough of React to run the component and replay its hook state.
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    return { type, props: { ...props, children } }
  },
  useEffect(effect, dependencies = []) {
    const index = hookIndex++
    const states = activeHooks.hooks
    const previous = states[index]
    if (!previous || dependencies.some((value, at) => value !== previous.dependencies[at])) {
      states[index] = { dependencies }
      effect()
    }
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    const index = hookIndex++
    const instance = activeHooks
    const states = activeHooks.hooks
    if (!(index in states)) {
      const state = { snapshot: getSnapshot() }
      state.unsubscribe = subscribe(() => {
        state.snapshot = getSnapshot()
        instance.renderSoon()
      })
      states[index] = state
      externalSubscriptions += 1
    }
    return getSnapshot()
  },
  useState(initial) {
    const index = hookIndex++
    const instance = activeHooks
    const states = instance.hooks
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
    return [
      states[index],
      (next) => {
        const value = typeof next === 'function' ? next(states[index]) : next
        if (!Object.is(value, states[index])) {
          states[index] = value
          instance.renderSoon()
        }
      },
    ]
  },
}

const client = captured.factory((id) => {
  if (id === 'react') return React
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Toast: FakeToast }
  throw new Error(`unexpected module: ${id}`)
})

function resetHooks() {
  hookInstances = new Map()
  activeHooks = undefined
  hookIndex = 0
  externalSubscriptions = 0
}

function renderComponent(component, props, renderer) {
  const previousHooks = activeHooks
  const previousIndex = hookIndex
  if (!renderer.instances.has(component)) {
    renderer.instances.set(component, {
      hooks: [],
      renderer,
      renderSoon: () => renderer.renderSoon(),
    })
  }
  const instance = renderer.instances.get(component)
  try {
    activeHooks = instance
    hookIndex = 0
    return expand(component(props), renderer)
  } finally {
    activeHooks = previousHooks
    hookIndex = previousIndex
  }
}

function expand(node, renderer) {
  if (Array.isArray(node)) return node.map((child) => expand(child, renderer))
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function' && node.type !== FakeToast) return renderComponent(node.type, node.props, renderer)
  return {
    ...node,
    props: { ...node.props, children: expand(node.props?.children, renderer) },
  }
}

function createRenderer(component, getProps) {
  const renderer = {
    instances: new Map(),
    scheduled: false,
    disposed: false,
    tree: null,
    render() {
      renderer.tree = renderComponent(component, getProps(), renderer)
      return renderer.tree
    },
    renderSoon() {
      if (renderer.scheduled || renderer.disposed) return
      renderer.scheduled = true
      queueMicrotask(() => {
        renderer.scheduled = false
        if (!renderer.disposed) renderer.render()
      })
    },
    async flush() {
      await new Promise((resolve) => queueMicrotask(resolve))
      return renderer.tree
    },
  }
  renderer.render()
  return renderer
}

function mount(executeImpl, initialSettings = {}, configOptions = {}) {
  const registers = []
  const executed = []
  const mutations = []
  let snapshot = {
    status: 'ready',
    base: {
      recallSessionEnabled: false,
      unseenQuestionCount: 3,
      unseenQuestionType: 'short-answer',
    },
    user: {},
    value: {
      recallSessionEnabled: false,
      unseenQuestionCount: 3,
      unseenQuestionType: 'short-answer',
    },
    revision: 4,
    writable: true,
    ...initialSettings,
  }
  const listeners = new Set()
  let descriptionSnapshot = {
    status: configOptions.descriptionStatus ?? 'ready',
    error: configOptions.descriptionError ?? null,
    view: {
      namespaces: configOptions.available === false ? [] : [{ ns: 'dsh-nerd-mode' }],
    },
  }
  const descriptionListeners = new Set()
  const description = {
    getSnapshot: () => descriptionSnapshot,
    subscribe(listener) {
      descriptionListeners.add(listener)
      return () => descriptionListeners.delete(listener)
    },
  }
  let getCalls = 0
  const scope = {
    getSnapshot: () => snapshot,
    setSnapshot(next) {
      snapshot = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async mutate(operations, revision) {
      if (configOptions.mutateError) throw configOptions.mutateError
      mutations.push({ operations, revision })
      const user = { ...snapshot.user }
      for (const operation of operations) {
        const key = operation.path[0]
        if (operation.op === 'set') user[key] = operation.value
        else delete user[key]
      }
      snapshot = {
        ...snapshot,
        user,
        value: { ...snapshot.base, ...user },
        revision: snapshot.revision + 1,
      }
      for (const listener of listeners) listener()
      return true
    },
  }
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
    configForms: {
      get(namespace) {
        getCalls += 1
        assert.equal(namespace, 'dsh-nerd-mode')
        return scope
      },
      describe: () => description,
    },
  }
  client.apply(ctx)
  return { registers, executed, mutations, scope, getCalls: () => getCalls, description }
}

function render(active, executeImpl) {
  const { registers, executed } = mount(executeImpl)
  const injected = registers[0].options.inject('session-1')
  const component = registers[0].component
  let projectionKey
  let current = active
  resetHooks()
  const renderer = createRenderer(component, () => ({
      useProjection: (name) => {
        projectionKey = name
        return { active: current }
      },
      ...injected,
    }))
  return {
    get tree() { return renderer.tree },
    executed,
    projectionKey: () => projectionKey,
    rerender: (value = current) => {
      current = value
      return renderer.render()
    },
    flush: () => renderer.flush(),
  }
}

const buttonOf = (tree) => tree.props.children.find((child) => child?.type === 'button')
const toastOf = (tree) => tree.props.children.find((child) => child?.type === FakeToast)

test('registers one toggle in the composer bar', () => {
  assert.ok(client.inject.includes('remote'))
  assert.ok(client.inject.includes('remote.commands'))
  const { registers } = mount()
  const { options } = registers.find(({ options }) => options.name === 'conversation.input.left')
  assert.equal(options.name, 'conversation.input.left')
  assert.equal(options.id, 'nerd-mode')
  assert.equal(options.order, -1)
})

function renderSettings(initialSettings, configOptions) {
  const mounted = mount(undefined, initialSettings, configOptions)
  const registration = mounted.registers.find(({ options }) => options.name === 'settings.section')
  assert.ok(registration)
  resetHooks()
  const renderer = createRenderer(registration.component, () => ({ close() {} }))
  return {
    ...mounted,
    get tree() { return renderer.tree },
    rerender: () => renderer.render(),
    flush: () => renderer.flush(),
  }
}

function allOfType(tree, type) {
  const matches = []
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== 'object') return
    if (node.type === type) matches.push(node)
    visit(node.props?.children)
  }
  visit(tree)
  return matches
}

const textOf = (node) => {
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return node?.props ? textOf(node.props.children) : ''
}

test('registers a standalone Nerd Mode settings section', () => {
  const { registers } = mount()
  const settings = registers.filter(({ options }) => options.name === 'settings.section')
  assert.equal(settings.length, 1)
  assert.equal(settings[0].options.id, 'dsh-nerd-mode')
  assert.equal(settings[0].options.label, 'Nerd Mode')
  assert.equal(settings[0].options.order, 30)
  assert.deepEqual(client.inject, ['slots', 'remote', 'remote.commands', 'configForms'])
})

test('uses the settings section close prop and subscribes with useSyncExternalStore', () => {
  const mounted = mount()
  const registration = mounted.registers.find(({ options }) => options.name === 'settings.section')
  assert.equal(registration.options.inject, undefined)
  let closed = false
  resetHooks()
  const renderer = createRenderer(registration.component, () => ({ close: () => { closed = true } }))
  const tree = renderer.tree
  assert.ok(externalSubscriptions >= 2)
  allOfType(tree, 'button').find(({ props }) => textOf(props.children) === 'Restore defaults').props.onClick()
  const readOnly = mount(undefined, { writable: false }, { available: false })
  const readOnlyRegistration = readOnly.registers.find(({ options }) => options.name === 'settings.section')
  resetHooks()
  const readOnlyTree = createRenderer(readOnlyRegistration.component, () => ({ close: () => { closed = true } })).tree
  allOfType(readOnlyTree, 'button').find(({ props }) => textOf(props.children) === 'Close').props.onClick()
  assert.equal(closed, true)
})

test('setState schedules a rerender for the component that owns the hook', async () => {
  const view = renderSettings()
  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '2' } })
  assert.equal(allOfType(view.tree, 'input')[0].props.value, '3')
  await view.flush()
  assert.equal(allOfType(view.tree, 'input')[0].props.value, '2')
})

test('renders two settings groups with the profile defaults', () => {
  const view = renderSettings()
  assert.match(view.tree.props.style.color, /--dsw-alias-label-primary/)
  assert.match(view.tree.props.style.fontFamily, /--dsw-font-family/)
  const groups = allOfType(view.tree, 'section')
  assert.deepEqual(groups.map(({ props }) => props['data-settings-group']), [
    'recall-session',
    'post-lecture-questions',
  ])
  assert.equal(groups.every(({ props }) => props.style.background === 'var(--dsw-alias-bg-layer-1)'), true)
  assert.equal(groups.every(({ props }) => props.style.border.includes('--dsw-alias-border-l2')), true)

  const count = allOfType(view.tree, 'input').find(({ props }) => props['data-setting'] === 'unseenQuestionCount')
  const questionType = allOfType(view.tree, 'select').find(({ props }) => props['data-setting'] === 'unseenQuestionType')
  assert.equal(count.props.value, '3')
  assert.equal(questionType.props.value, 'short-answer')
  assert.equal(allOfType(view.tree, 'label').some(({ props }) => props.htmlFor === count.props.id && textOf(props.children).includes('Question count')), true)
  assert.equal(allOfType(view.tree, 'label').some(({ props }) => props.htmlFor === questionType.props.id && textOf(props.children).includes('Question type')), true)
  const recall = allOfType(view.tree, 'button').find(({ props }) => props['data-setting'] === 'recallSessionEnabled')
  assert.equal(recall.props['aria-checked'], false)
  assert.deepEqual(allOfType(view.tree, 'button').map(textOf).filter((text) => ['Save', 'Cancel', 'Restore defaults'].includes(text)).sort(), [
    'Cancel',
    'Restore defaults',
    'Save',
  ])
})

test('shows loading and unavailable states without requesting an absent form', () => {
  const loading = renderSettings(undefined, { descriptionStatus: 'loading', available: false })
  assert.match(textOf(loading.tree), /Loading Nerd Mode settings/)
  assert.equal(loading.getCalls(), 0)

  const unavailable = renderSettings(undefined, { available: false })
  assert.match(textOf(unavailable.tree), /unavailable in this profile/)
  assert.equal(unavailable.getCalls(), 0)

  const failed = renderSettings(undefined, { descriptionStatus: 'idle', descriptionError: 'offline', available: false })
  assert.match(textOf(failed.tree), /could not be loaded/)
  assert.equal(failed.getCalls(), 0)

  const ready = renderSettings()
  assert.equal(ready.getCalls(), 1)
  assert.ok(externalSubscriptions >= 2)
})

test('shows loading and unavailable states for a served form', () => {
  const loading = renderSettings({ status: 'loading' })
  assert.match(textOf(loading.tree), /Loading Nerd Mode settings/)
  assert.equal(loading.getCalls(), 1)
  assert.equal(allOfType(loading.tree, 'input').length, 0)
  assert.equal(allOfType(loading.tree, 'select').length, 0)
  assert.equal(allOfType(loading.tree, 'button').some(({ props }) => textOf(props.children) === 'Save'), false)

  const unavailable = renderSettings({ status: 'unavailable' })
  assert.match(textOf(unavailable.tree), /unavailable in this profile/)
  assert.equal(allOfType(unavailable.tree, 'button').some(({ props }) => textOf(props.children) === 'Close'), true)
  assert.equal(allOfType(unavailable.tree, 'input').length, 0)
  assert.equal(allOfType(unavailable.tree, 'select').length, 0)

  const unexpected = renderSettings({ status: 'error' })
  assert.match(textOf(unexpected.tree), /could not be loaded/)
  assert.equal(allOfType(unexpected.tree, 'input').length, 0)
  assert.equal(allOfType(unexpected.tree, 'select').length, 0)
})

test('hydrates after loading and Cancel reads the latest accepted snapshot', async () => {
  const view = renderSettings({ status: 'loading', writable: true })
  assert.match(textOf(view.tree), /Loading Nerd Mode settings/)
  view.scope.setSnapshot({
    status: 'ready',
    base: { recallSessionEnabled: false, unseenQuestionCount: 3, unseenQuestionType: 'short-answer' },
    user: { unseenQuestionCount: 6 },
    value: { recallSessionEnabled: false, unseenQuestionCount: 6, unseenQuestionType: 'short-answer' },
    revision: 5,
    writable: true,
  })
  await view.flush()
  assert.equal(allOfType(view.tree, 'input')[0].props.value, '6')

  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '2' } })
  await view.flush()
  view.scope.setSnapshot({
    ...view.scope.getSnapshot(),
    user: { unseenQuestionCount: 7 },
    value: { ...view.scope.getSnapshot().value, unseenQuestionCount: 7 },
    revision: 6,
  })
  allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Cancel').props.onClick()
  await view.flush()
  assert.equal(allOfType(view.tree, 'input')[0].props.value, '7')
})

test('keeps edits in a draft until save and writes all changed profile values together', async () => {
  const view = renderSettings()
  allOfType(view.tree, 'input').find(({ props }) => props['data-setting'] === 'unseenQuestionCount').props.onChange({ target: { value: '5' } })
  await view.flush()
  allOfType(view.tree, 'select')[0].props.onChange({ target: { value: 'mixed' } })
  await view.flush()
  const recall = allOfType(view.tree, 'button').find(({ props }) => props['data-setting'] === 'recallSessionEnabled')
  recall.props.onClick()
  await view.flush()

  assert.equal(view.mutations.length, 0)
  const save = allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Save')
  await save.props.onClick()
  await view.flush()

  assert.equal(view.mutations.length, 1)
  assert.deepEqual(view.mutations, [{
    revision: 4,
    operations: [
      { op: 'set', path: ['recallSessionEnabled'], value: true },
      { op: 'set', path: ['unseenQuestionCount'], value: 5 },
      { op: 'set', path: ['unseenQuestionType'], value: 'mixed' },
    ],
  }])
  assert.equal(view.scope.getSnapshot().value.unseenQuestionCount, 5)
  assert.match(textOf(view.rerender()), /Saved to this profile/)
})

test('Cancel restores accepted values and Restore defaults changes only the draft', async () => {
  const view = renderSettings({
    user: { recallSessionEnabled: true, unseenQuestionCount: 8, unseenQuestionType: 'mixed' },
    value: { recallSessionEnabled: true, unseenQuestionCount: 8, unseenQuestionType: 'mixed' },
  })
  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '1' } })
  await view.flush()
  allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Cancel').props.onClick()
  await view.flush()
  assert.equal(allOfType(view.tree, 'input')[0].props.value, '8')

  allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Restore defaults').props.onClick()
  await view.flush()
  const restored = view.tree
  assert.equal(allOfType(restored, 'input')[0].props.value, '3')
  assert.equal(view.scope.getSnapshot().value.unseenQuestionCount, 8)
  assert.equal(view.mutations.length, 0)
  await allOfType(restored, 'button').find(({ props }) => textOf(props.children) === 'Save').props.onClick()
  await view.flush()
  assert.deepEqual(view.mutations[0].operations, [
    { op: 'unset', path: ['recallSessionEnabled'] },
    { op: 'unset', path: ['unseenQuestionCount'] },
    { op: 'unset', path: ['unseenQuestionType'] },
  ])
})

test('disables Restore defaults while the profile is read-only', () => {
  const view = renderSettings({ writable: false })
  const restore = allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Restore defaults')
  assert.equal(restore.props.disabled, true)
})

test('saves the revision returned by the latest accepted snapshot', async () => {
  const view = renderSettings()
  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '4' } })
  await view.flush()
  view.scope.setSnapshot({
    ...view.scope.getSnapshot(),
    revision: 9,
    value: { ...view.scope.getSnapshot().value, unseenQuestionCount: 7 },
    user: { unseenQuestionCount: 7 },
  })
  const count = allOfType(view.tree, 'input')[0]
  count.props.onChange({ target: { value: '4' } })
  await view.flush()
  await allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Save').props.onClick()
  await view.flush()
  assert.equal(view.mutations[0].revision, 9)
})

test('rejects invalid question counts and keeps the draft after save errors', async () => {
  const view = renderSettings()
  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '11' } })
  await view.flush()
  const invalid = view.tree
  const save = allOfType(invalid, 'button').find(({ props }) => textOf(props.children) === 'Save')
  assert.equal(save.props.disabled, true)
  assert.equal(view.mutations.length, 0)

  const mutate = view.scope.mutate
  view.scope.mutate = async (...args) => {
    if (args[0].some(({ path }) => path[0] === 'unseenQuestionCount')) throw new Error('profile is read-only')
    return mutate(...args)
  }
  allOfType(view.tree, 'input')[0].props.onChange({ target: { value: '4' } })
  await view.flush()
  await allOfType(view.tree, 'button').find(({ props }) => textOf(props.children) === 'Save').props.onClick()
  await view.flush()
  const after = view.tree
  assert.equal(allOfType(after, 'input')[0].props.value, '4')
  assert.match(textOf(after), /profile is read-only/)
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
