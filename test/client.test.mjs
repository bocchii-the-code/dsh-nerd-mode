import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'

// client.js calls window.__ModuleLoader__.load at import time.
let captured
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }
await import('../client.js')

const realFetch = globalThis.fetch
let marketCalls = []

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

// Routes match on a URL substring. A response is a value or a function of the request.
function stubFetch(routes) {
  marketCalls = []
  globalThis.fetch = async (url, options = {}) => {
    const request = { url: String(url), method: options.method ?? 'GET', body: options.body }
    marketCalls.push(request)
    const route = routes.find(({ match, method = 'GET' }) => method === request.method
      && (match instanceof RegExp ? match.test(request.url) : request.url.includes(match)))
    if (route === undefined) return jsonResponse({ error: 'no route' }, 404)
    return typeof route.respond === 'function' ? route.respond(request) : route.respond
  }
  return marketCalls
}

afterEach(() => {
  globalThis.fetch = realFetch
})

// The host locale service: one active key, a subscriber list, an English fallback.
// The snapshot carries the active locale, the selectable locales, and a revision.
function fakeLocale(language = 'en') {
  let snapshot = { active: language, locales: ['en', 'zh'], revision: 0 }
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    resolveText(text) {
      return text[snapshot.active] ?? text.en
    },
    switchTo(next) {
      snapshot = { ...snapshot, active: next, revision: snapshot.revision + 1 }
      for (const listener of listeners) listener()
    },
  }
}

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
  const dockTypes = []
  const opened = []
  const locale = fakeLocale(configOptions.locale ?? 'en')
  const fetchCalls = stubFetch(configOptions.market ?? [])
  const ctx = {
    effect(fn) {
      return fn()
    },
    get(name) {
      return name.split('.').reduce((value, key) => value?.[key], ctx)
    },
    inject(deps, callback) {
      const has = (name) => name.split('.').reduce((value, key) => value?.[key], ctx) !== undefined
      if (!deps.every(has)) return () => {}
      callback(ctx)
      return () => {}
    },
    ...(configOptions.dock === false ? {} : {
      sidebarRightTabs: {
        register(definition) {
          dockTypes.push(definition)
          return () => {}
        },
      },
    }),
    ...(configOptions.uiWorkspace === false ? {} : {
      uiWorkspace: configOptions.uiWorkspace ?? { openSession: (id) => opened.push(id) },
    }),
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
      workspaceFiles: configOptions.files ?? fileRemote(),
    },
    configForms: {
      get(namespace) {
        getCalls += 1
        assert.equal(namespace, 'dsh-nerd-mode')
        return scope
      },
      describe: () => description,
    },
    locale,
  }
  // Cordis has a scoped inject, but apply itself always runs.
  client.apply(ctx)
  return { registers, dockTypes, executed, mutations, scope, getCalls: () => getCalls, description, locale, fetchCalls, opened }
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

// A stand-in for ctx.remote.workspaceFiles. Directories come from `dirs`, text
// files from `files`, and a key in `failures` answers with that error instead.
function fileRemote({ files = {}, dirs = {}, failures = {} } = {}) {
  const calls = []
  const isDirectory = (path, name) => Boolean(dirs[`${path}/${name}`])
    || Object.keys(files).some((key) => key.startsWith(`${path}/${name}/`))
  return {
    calls,
    async list(sessionId, path) {
      calls.push(['list', sessionId, path])
      if (failures[path]) return { ok: false, error: failures[path] }
      if (!(path in dirs)) {
        return { ok: false, error: { code: 'workspace-file/not-found', message: `${path} is not a folder` } }
      }
      return {
        ok: true,
        value: {
          path,
          truncated: false,
          entries: dirs[path].map((name) => ({
            name,
            type: isDirectory(path, name) ? 'directory' : 'file',
          })),
        },
      }
    },
    async read(sessionId, path, range) {
      calls.push(['read', sessionId, path, range])
      if (failures[path]) return { ok: false, error: failures[path] }
      if (!(path in files)) {
        return { ok: false, error: { code: 'workspace-file/not-found', message: `${path} does not exist` } }
      }
      const text = files[path]
      return {
        ok: true,
        value: { text, offset: 1, lines: text.split('\n').length, eof: true },
      }
    },
  }
}

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
    async settle() {
      for (let turn = 0; turn < 60; turn += 1) {
        await new Promise((resolve) => queueMicrotask(resolve))
      }
      return renderer.tree
    },
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

const courseSelect = (tree) => allOfType(tree, 'select')
  .find(({ props }) => props['aria-label'] === 'Course')

test('registers a standalone Nerd Mode settings section', () => {
  const { registers } = mount()
  const settings = registers.filter(({ options }) => options.name === 'settings.section')
  assert.equal(settings.length, 1)
  assert.equal(settings[0].options.id, 'dsh-nerd-mode')
  assert.equal(settings[0].options.label, 'Nerd Mode')
  assert.equal(settings[0].options.order, 30)
  assert.deepEqual(client.inject, ['slots', 'remote', 'remote.commands', 'remote.workspaceFiles', 'configForms'])
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

// --- About group -------------------------------------------------------------

const MARKET = {
  capabilities: '/dsh-market/api/v1/capabilities',
  updates: '/dsh-market/api/v1/updates',
  operations: '/dsh-market/api/v1/operations',
  restart: '/dsh-market/api/v1/restart',
}
const UPDATE_SCHEMA = 'dsh-market/update-api/v1'

const capabilitiesBody = ({ profile = 'work', update = true, restart = true } = {}) => ({
  schema: UPDATE_SCHEMA,
  profile,
  features: { update, restart },
  endpoints: {
    updates: MARKET.updates,
    operations: MARKET.operations,
    ...(restart ? { restart: MARKET.restart } : {}),
  },
})

const releaseBody = (overrides = {}) => ({
  schema: UPDATE_SCHEMA,
  package: {
    name: 'dsh-nerd-mode',
    source: 'npm',
    installedVersion: '0.4.4',
    latestVersion: '0.4.5',
    updateAvailable: true,
    channelSwitch: null,
    ...overrides,
  },
})

const operationBody = (overrides = {}) => ({
  schema: UPDATE_SCHEMA,
  operation: {
    operationId: 'op-1',
    packageName: 'dsh-nerd-mode',
    state: 'succeeded',
    beforeVersion: '0.4.4',
    installedVersion: '0.4.5',
    outcome: { refreshRequired: true, restartRequired: true, rollback: null },
    failure: null,
    ...overrides,
  },
})

// The default run: capabilities and a release, with no operation involved.
const marketRoutes = () => [
  { match: MARKET.capabilities, respond: jsonResponse(capabilitiesBody()) },
  { match: MARKET.updates, respond: jsonResponse(releaseBody()) },
]

// The same run plus a single operation that reaches a terminal state on the first poll.
const updateRoutes = ({ capabilities = capabilitiesBody(), operation = operationBody() } = {}) => [
  { match: MARKET.capabilities, respond: jsonResponse(capabilities) },
  { match: MARKET.updates, respond: jsonResponse(releaseBody()) },
  { match: MARKET.updates, method: 'POST', respond: jsonResponse({ schema: UPDATE_SCHEMA, operation: { operationId: 'op-1' } }, 202) },
  { match: MARKET.operations, respond: jsonResponse(operation) },
  { match: MARKET.restart, method: 'POST', respond: jsonResponse({ schema: UPDATE_SCHEMA }) },
]

const buttonNamed = (tree, text) => allOfType(tree, 'button')
  .find(({ props }) => textOf(props.children) === text)

async function confirmUpdate(view) {
  buttonNamed(view.tree, 'Update to v0.4.5').props.onClick()
  return view.settle()
}

test('the About group checks on mount and shows both versions without force', async () => {
  const view = renderSettings(undefined, { market: marketRoutes() })
  const tree = await view.settle()

  assert.match(textOf(tree), /Installed v0\.4\.4 · latest v0\.4\.5/)
  assert.equal(view.fetchCalls[0].url, MARKET.capabilities)
  const check = view.fetchCalls.find(({ url }) => url.startsWith(MARKET.updates))
  assert.match(check.url, /name=dsh-nerd-mode/)
  assert.doesNotMatch(check.url, /force/)
  assert.equal(view.fetchCalls.length, 2)
  assert.equal(view.fetchCalls.every(({ method }) => method === 'GET'), true)
})

test('confirming posts the package once and a succeeded operation offers the restart', async () => {
  const view = renderSettings(undefined, { market: updateRoutes() })
  await view.settle()

  const confirming = await confirmUpdate(view)
  assert.match(textOf(confirming), /Install v0\.4\.5 and restart DSH afterwards\?/)
  assert.equal(buttonNamed(confirming, 'Cancel') !== undefined, true)

  buttonNamed(confirming, 'Update').props.onClick()
  const installed = await view.settle()

  const posts = view.fetchCalls.filter(({ method, url }) => method === 'POST' && url === MARKET.updates)
  assert.equal(posts.length, 1)
  assert.deepEqual(JSON.parse(posts[0].body), { packageName: 'dsh-nerd-mode' })
  assert.equal(view.fetchCalls.some(({ url }) => url.startsWith(MARKET.operations)), true)
  assert.match(textOf(installed), /Installed v0\.4\.5/)
  assert.match(textOf(installed), /Restart DSH to use v0\.4\.5\./)

  buttonNamed(installed, 'Restart now').props.onClick()
  const restarted = await view.settle()

  const restarts = view.fetchCalls.filter(({ method, url }) => method === 'POST' && url === MARKET.restart)
  assert.equal(restarts.length, 1)
  assert.equal(restarts[0].body, '{}')
  assert.match(textOf(restarted), /DSH is restarting/)
})

test('hides the restart button when the Market cannot restart', async () => {
  const view = renderSettings(undefined, {
    market: updateRoutes({ capabilities: capabilitiesBody({ restart: false }) }),
  })
  await view.settle()
  const confirming = await confirmUpdate(view)
  buttonNamed(confirming, 'Update').props.onClick()
  const installed = await view.settle()

  assert.equal(buttonNamed(installed, 'Restart now'), undefined)
  assert.equal(buttonNamed(installed, 'Check again') !== undefined, true)
  assert.match(textOf(installed), /Installed v0\.4\.5/)
})

test('a linked install stays local, reveals the note, and posts nothing', async () => {
  const view = renderSettings(undefined, {
    market: [
      { match: MARKET.capabilities, respond: jsonResponse(capabilitiesBody()) },
      {
        match: MARKET.updates,
        respond: jsonResponse(releaseBody({ source: 'linked', latestVersion: null, updateAvailable: false })),
      },
    ],
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /Local v0\.4\.4/)
  const about = buttonNamed(tree, 'About local installs')
  assert.ok(about)
  about.props.onClick()
  const revealed = await view.settle()

  assert.match(textOf(revealed), /linked to a folder\. Update it with git, not npm\./)
  assert.equal(buttonNamed(revealed, 'About local installs') !== undefined, true)
  assert.equal(view.fetchCalls.every(({ method }) => method === 'GET'), true)
})

test('an installed version ahead of npm offers no downgrade', async () => {
  const view = renderSettings(undefined, {
    market: [
      { match: MARKET.capabilities, respond: jsonResponse(capabilitiesBody()) },
      {
        match: MARKET.updates,
        respond: jsonResponse(releaseBody({ installedVersion: '0.5.0', updateAvailable: false })),
      },
    ],
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /Local v0\.5\.0 · npm v0\.4\.5/)
  assert.match(textOf(tree), /This copy is newer than npm\. No update\./)
  assert.equal(buttonNamed(tree, 'Update to v0.4.5'), undefined)
})

test('a missing Market shows the manual command with a literal profile', async () => {
  const view = renderSettings(undefined, { market: [] })
  const tree = await view.settle()

  assert.match(textOf(tree), /dsh plugin --profile <profile> add dsh-nerd-mode/)
  assert.equal(view.fetchCalls.length, 1)
  assert.equal(view.fetchCalls[0].url, MARKET.capabilities)
  assert.equal(buttonNamed(tree, 'Check again'), undefined)
  assert.equal(buttonNamed(tree, 'Try again'), undefined)
})

test('a failed operation shows its message and retries with force', async () => {
  const view = renderSettings(undefined, {
    market: [
      { match: MARKET.capabilities, respond: jsonResponse(capabilitiesBody()) },
      { match: MARKET.updates, respond: jsonResponse(releaseBody()) },
      {
        match: MARKET.updates,
        method: 'POST',
        respond: (request) => jsonResponse({
          schema: UPDATE_SCHEMA,
          operation: { operationId: JSON.parse(request.body).force === true ? 'op-2' : 'op-1' },
        }, 202),
      },
      {
        match: MARKET.operations,
        respond: (request) => jsonResponse(request.url.includes('op-2')
          ? operationBody({ operationId: 'op-2' })
          : operationBody({
              operationId: 'op-1',
              state: 'failed',
              outcome: null,
              failure: { code: 'RELEASE_TOO_FRESH', message: 'The release is too fresh.', retryable: true },
            })),
      },
    ],
  })
  await view.settle()
  const confirming = await confirmUpdate(view)
  buttonNamed(confirming, 'Update').props.onClick()
  const failed = await view.settle()

  assert.match(textOf(failed), /The release is too fresh\./)
  assert.match(textOf(failed), /dsh plugin --profile work add dsh-nerd-mode/)

  buttonNamed(failed, 'Try again').props.onClick()
  const retried = await view.settle()

  const posts = view.fetchCalls.filter(({ method, url }) => method === 'POST' && url === MARKET.updates)
  assert.equal(posts.length, 2)
  assert.deepEqual(JSON.parse(posts[1].body), { packageName: 'dsh-nerd-mode', force: true })
  assert.match(textOf(retried), /Installed v0\.4\.5/)
})

test('renders the whole settings section in Chinese when the locale is zh', async () => {
  const view = renderSettings(undefined, { locale: 'zh', market: marketRoutes() })
  const tree = await view.settle()

  assert.match(textOf(tree), /恢复默认/)
  assert.match(textOf(tree), /关于/)
  assert.match(textOf(tree), /新 study-plus 会话的 profile 默认值/)
  assert.match(textOf(tree), /已安装 v0\.4\.4 · 最新 v0\.4\.5/)
  assert.doesNotMatch(textOf(tree), /Restore defaults/)
})

test('follows a language switch without remounting the section', async () => {
  const view = renderSettings(undefined, { market: marketRoutes() })
  await view.settle()
  assert.match(textOf(view.tree), /Restore defaults/)

  view.locale.switchTo('zh')
  const tree = await view.settle()

  assert.match(textOf(tree), /恢复默认/)
  assert.match(textOf(tree), /更新到 v0\.4\.5/)
})

// --- Study tab ---------------------------------------------------------------

const GRAPH_TWO_CHAPTERS = [
  '# Course: gradient-descent',
  'Book: Learning from Data',
  '',
  '## Chapters',
  '1. Foundations: the basics',
  '2. Optimization: getting faster',
  '',
  '| # | Concept | Definition | Prerequisites | Chapter | Section |',
  '|---|---|---|---|---|---:|',
  '| 1 | Loss function | how wrong the model is | - | 1 | 1 |',
  '| 2 | Gradient | the slope of the loss | 1 | 1 | 2 |',
  '| 3 | Learning rate | how far one step goes | 2 | 2 | 1 |',
  '| 4 | Momentum | carry the last step | 3 | 2 | 2 |',
].join('\n')

const STATE_TWO_CHAPTERS = [
  '| # | Concept | State | Last evidence | Passes | Misses | Note |',
  '|---|---|---|---|---|---|---|',
  '| 1 | Loss function | fluent | 2026-10-20 | 1 | 0 | |',
  '| 2 | Gradient | shaky | 2026-10-28 | 0 | 2 | sign flip |',
  '| 3 | Learning rate | shaky | 2026-10-27 | 0 | 1 | too large |',
  '| 4 | Momentum | new | - | 0 | 0 | |',
].join('\n')

const LOG_TWO_CYCLES = [
  '## 2026-10-26',
  'Concept: Momentum',
  'Gap: teaching stopped before the questions',
  '',
  '## 2026-10-27',
  'Concept: Learning rate',
  'Result: 1 of 3 correct',
  'Gap: the step was too large',
  '',
  '## 2026-10-28',
  'Concept: Gradient',
  'Result: 2 of 3 correct; teach-back incomplete',
  'Gap: the sign',
].join('\n')

const STATE_HEADER = [
  '| # | Concept | State | Last evidence | Passes | Misses | Note |',
  '|---|---|---|---|---|---|---|',
].join('\n')

const GRAPH_HEADER = [
  '| # | Concept | Definition | Prerequisites | Chapter | Section |',
  '|---|---|---|---|---:|---:|',
].join('\n')

function renderStudy(fixture) {
  const files = fileRemote(fixture)
  const mounted = mount(undefined, {}, { files })
  const registration = mounted.registers.find(({ options }) => options.name === 'conversation.view')
  assert.ok(registration, 'the client registers a conversation view')
  const injected = registration.options.inject('session-1')
  resetHooks()
  const renderer = createRenderer(registration.component, () => injected)
  return {
    ...mounted,
    files,
    registration,
    get tree() { return renderer.tree },
    async settle() {
      for (let turn = 0; turn < 60; turn += 1) {
        await new Promise((resolve) => queueMicrotask(resolve))
      }
      return renderer.tree
    },
  }
}

function stripOf(tree) {
  const list = allOfType(tree, 'dl')[0]
  return list.props.children.map((cell) => ({
    label: textOf(allOfType(cell, 'dt')[0]),
    value: textOf(allOfType(cell, 'dd')[0]),
  }))
}

const sectionOf = (tree, name) => allOfType(tree, 'section')
  .find(({ props }) => props['data-study-section'] === name)
const rowsOf = (tree, name) => allOfType(sectionOf(tree, name), 'li').map(textOf)

const studyFixture = (overrides = {}) => ({
  dirs: {
    study: ['gradient-descent'],
    'study/gradient-descent': ['graph.md', 'log.md', 'state.md'],
  },
  files: {
    'study/gradient-descent/graph.md': GRAPH_TWO_CHAPTERS,
    'study/gradient-descent/log.md': LOG_TWO_CYCLES,
    'study/gradient-descent/state.md': STATE_TWO_CHAPTERS,
  },
  ...overrides,
})

test('registers a Study view after the shipped tabs', () => {
  const { registers } = mount()
  const views = registers.filter(({ options }) => options.name === 'conversation.view')
  assert.equal(views.length, 1)
  assert.equal(views[0].options.id, 'study')
  assert.equal(views[0].options.label, 'Study')
  assert.equal(views[0].options.order, 100)
  const injected = views[0].options.inject('session-9')
  assert.equal(injected.sessionId, 'session-9')
  assert.equal(typeof injected.workspaceFiles.read, 'function')
  assert.equal(typeof injected.workspaceFiles.list, 'function')
})

test('shows progress, the three Sections, shaky Concepts, and recent cycles', async () => {
  const view = renderStudy(studyFixture())
  const tree = await view.settle()

  assert.match(textOf(tree), /25% of the Book/)
  const progress = allOfType(tree, 'div').find(({ props }) => props.role === 'progressbar')
  assert.equal(progress.props['aria-valuenow'], 25)
  assert.equal(progress.props['aria-valuemin'], 0)
  assert.equal(progress.props['aria-valuemax'], 100)
  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'region' && props['aria-label'] === 'Study'), true)
  assert.equal(allOfType(tree, 'select').length, 0)
  assert.deepEqual(stripOf(tree), [
    { label: 'Previous', value: 'Foundations · Section 1 · Loss function' },
    { label: 'Current', value: 'Foundations · Section 2 · Gradient' },
    { label: 'Next', value: 'Optimization · Section 1 · Learning rate' },
  ])
  assert.deepEqual(rowsOf(tree, 'shaky'), [
    'Foundations · Section 2 · Gradient',
    'Optimization · Section 1 · Learning rate',
  ])
  assert.deepEqual(rowsOf(tree, 'cycles'), [
    '2026-10-28 · 2 of 3 correct; teach-back incomplete',
    '2026-10-27 · 1 of 3 correct',
    '2026-10-26 · Momentum',
  ])
  assert.deepEqual([...new Set(view.files.calls.map(([method]) => method))], ['list', 'read'])
})

test('places a legacy graph in chapter one and keeps row order', async () => {
  const view = renderStudy({
    dirs: { study: ['legacy'], 'study/legacy': ['graph.md', 'state.md'] },
    files: {
      'study/legacy/graph.md': [
        '# Topic: legacy',
        '',
        '| # | Concept | Definition | Prerequisites |',
        '|---|---|---|---|',
        '| 1 | Alpha | first | - |',
        '| 2 | Beta | second | 1 |',
      ].join('\n'),
      'study/legacy/state.md': [
        STATE_HEADER,
        '| 1 | Alpha | fluent | 2026-10-01 | 1 | 0 | |',
        '| 2 | Beta | new | - | 0 | 0 | |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /50% of the Book/)
  assert.deepEqual(stripOf(tree), [
    { label: 'Previous', value: '—' },
    { label: 'Current', value: 'legacy · Section 1 · Alpha' },
    { label: 'Next', value: 'legacy · Section 2 · Beta' },
  ])
  const values = allOfType(tree, 'dd')
  assert.equal(values[0].props.style.color, 'var(--dsw-alias-label-tertiary)')
  assert.equal(values[1].props.style.color, undefined)
})

test('shows a dash when every Concept is skipped', async () => {
  const view = renderStudy({
    dirs: { study: ['done'], 'study/done': ['graph.md', 'state.md'] },
    files: {
      'study/done/graph.md': [
        '# Topic: done',
        GRAPH_HEADER,
        '| 1 | Alpha | first | - | 1 | 1 |',
        '| 2 | Beta | second | 1 | 1 | 2 |',
      ].join('\n'),
      'study/done/state.md': [
        STATE_HEADER,
        '| 1 | Alpha | skipped | - | 0 | 0 | self-report, done |',
        '| 2 | Beta | skipped | - | 0 | 0 | self-report, done |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'progressbar'), false)
  const figure = allOfType(tree, 'div').find(({ props }) => props['data-study-progress'] === 'none')
  assert.equal(textOf(allOfType(figure, 'p')[0]), '—')
  assert.match(textOf(tree), /Every Concept is skipped/)
})

test('shows zero progress and the next graph Section when the state table is missing', async () => {
  const view = renderStudy({
    dirs: { study: ['fresh'], 'study/fresh': ['graph.md'] },
    files: {
      'study/fresh/graph.md': [
        '# Topic: fresh',
        'Book: Fresh Book',
        GRAPH_HEADER,
        '| 1 | First | a | - | 1 | 1 |',
        '| 2 | Second | b | 1 | 1 | 2 |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /0% of the Book/)
  assert.match(textOf(tree), /No evidence yet/)
  assert.deepEqual(stripOf(tree), [
    { label: 'Previous', value: '—' },
    { label: 'Current', value: 'No lesson recorded yet' },
    { label: 'Next', value: 'Fresh Book · Section 1 · First' },
  ])
})

test('ignores a malformed state row and says how many', async () => {
  const view = renderStudy({
    dirs: { study: ['broken'], 'study/broken': ['graph.md', 'state.md'] },
    files: {
      'study/broken/graph.md': [
        '# Topic: broken',
        GRAPH_HEADER,
        '| 1 | Alpha | first | - | 1 | 1 |',
        '| 2 | Beta | second | 1 | 1 | 2 |',
        '| 3 | Gamma | third | 2 | 1 | 3 |',
      ].join('\n'),
      'study/broken/state.md': [
        STATE_HEADER,
        '| 1 | Alpha | fluent | 2026-10-20 | 1 | 0 | |',
        '| 2 | Beta | shaky | 2026-10-28 |',
        '| 3 | Gamma | new | - | 0 | 0 | |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /1 malformed row was ignored/)
  assert.match(textOf(tree), /33% of the Book/)
})

test('names the searched folder when the workspace has no Course', async () => {
  const view = renderStudy({ dirs: {}, files: {} })
  const tree = await view.settle()

  assert.match(textOf(tree), /No Course in study\//)
  assert.match(textOf(tree), /\/study-plus/)
})

test('names the failure when a Course file cannot be read', async () => {
  const view = renderStudy(studyFixture({
    failures: {
      'study/gradient-descent/state.md': { code: 'gateway/internal', message: 'Permission denied' },
    },
  }))
  const tree = await view.settle()

  assert.match(textOf(tree), /Permission denied/)
  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'progressbar'), false)
})

test('opens on the first Course by name and switches on request', async () => {
  const view = renderStudy({
    dirs: {
      study: ['alpha', 'beta'],
      'study/alpha': ['graph.md', 'state.md'],
      'study/beta': ['graph.md', 'state.md'],
    },
    files: {
      'study/alpha/graph.md': ['# Course: Alpha', 'Book: Alpha Book', GRAPH_HEADER, '| 1 | One | a | - | 1 | 1 |'].join('\n'),
      'study/alpha/state.md': [STATE_HEADER, '| 1 | One | fluent | 2026-10-01 | 1 | 0 | |'].join('\n'),
      'study/beta/graph.md': ['# Course: Beta', 'Book: Beta Book', GRAPH_HEADER, '| 1 | Two | b | - | 1 | 1 |'].join('\n'),
      'study/beta/state.md': [STATE_HEADER, '| 1 | Two | shaky | 2026-10-28 | 0 | 1 | |'].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.match(textOf(tree), /Alpha Book/)
  const select = courseSelect(tree)
  assert.deepEqual(select.props.children.map(textOf), ['alpha', 'beta'])
  assert.equal(select.props.value, 'alpha')

  select.props.onChange({ target: { value: 'beta' } })
  const switched = await view.settle()

  assert.match(textOf(switched), /Beta Book/)
  assert.equal(courseSelect(switched).props.value, 'beta')
})

test('says the Book is finished when nothing is left after the current Section', async () => {
  const view = renderStudy({
    dirs: { study: ['end'], 'study/end': ['graph.md', 'state.md'] },
    files: {
      'study/end/graph.md': [
        '# Topic: end',
        GRAPH_HEADER,
        '| 1 | Alpha | first | - | 1 | 1 |',
        '| 2 | Beta | second | 1 | 1 | 2 |',
      ].join('\n'),
      'study/end/state.md': [
        STATE_HEADER,
        '| 1 | Alpha | fluent | 2026-10-01 | 1 | 0 | |',
        '| 2 | Beta | fluent | 2026-10-02 | 1 | 0 | |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.deepEqual(stripOf(tree)[2], { label: 'Next', value: 'End of Book' })
})

test('says everything left is skipped when only skipped Concepts remain', async () => {
  const view = renderStudy({
    dirs: { study: ['left'], 'study/left': ['graph.md', 'state.md'] },
    files: {
      'study/left/graph.md': [
        '# Topic: left',
        GRAPH_HEADER,
        '| 1 | Alpha | first | - | 1 | 1 |',
        '| 2 | Beta | second | 1 | 1 | 2 |',
        '| 3 | Gamma | third | 2 | 1 | 3 |',
      ].join('\n'),
      'study/left/state.md': [
        STATE_HEADER,
        '| 1 | Alpha | fluent | 2026-10-01 | 1 | 0 | |',
        '| 2 | Beta | skipped | - | 0 | 0 | self-report, done |',
        '| 3 | Gamma | skipped | - | 0 | 0 | self-report, done |',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.deepEqual(stripOf(tree)[2], { label: 'Next', value: 'Everything left is skipped' })
})

test('lists five shaky Concepts and counts the rest', async () => {
  const numbers = [1, 2, 3, 4, 5, 6]
  const view = renderStudy({
    dirs: { study: ['many'], 'study/many': ['graph.md', 'state.md'] },
    files: {
      'study/many/graph.md': [
        '# Topic: many',
        GRAPH_HEADER,
        ...numbers.map((number) => `| ${number} | Concept ${number} | note | - | 1 | ${number} |`),
      ].join('\n'),
      'study/many/state.md': [
        STATE_HEADER,
        ...numbers.map((number) => `| ${number} | Concept ${number} | shaky | 2026-10-0${number} | 0 | 1 | |`),
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.deepEqual(rowsOf(tree, 'shaky'), [
    'many · Section 6 · Concept 6',
    'many · Section 5 · Concept 5',
    'many · Section 4 · Concept 4',
    'many · Section 3 · Concept 3',
    'many · Section 2 · Concept 2',
  ])
  assert.match(textOf(sectionOf(tree, 'shaky')), /1 more not shown/)
})

test('keeps the Course picker when the chosen Course has no graph', async () => {
  const view = renderStudy({
    dirs: { study: ['alpha', 'notes'], 'study/alpha': ['graph.md', 'state.md'], 'study/notes': [] },
    files: {
      'study/alpha/graph.md': ['# Course: Alpha', 'Book: Alpha Book', GRAPH_HEADER, '| 1 | One | a | - | 1 | 1 |'].join('\n'),
      'study/alpha/state.md': [STATE_HEADER, '| 1 | One | fluent | 2026-10-01 | 1 | 0 | |'].join('\n'),
    },
  })
  const tree = await view.settle()

  courseSelect(tree).props.onChange({ target: { value: 'notes' } })
  const switched = await view.settle()

  assert.match(textOf(switched), /No Course in study\/notes/)
  assert.equal(courseSelect(switched).props.value, 'notes')
})

// --- Lectures dock page ------------------------------------------------------

test('registers one Lectures dock page with a guide entry and one body', () => {
  const { dockTypes, registers } = mount()

  assert.equal(dockTypes.length, 1)
  const [definition] = dockTypes
  assert.equal(definition.id, 'dsh-nerd-mode/lectures')
  assert.equal(definition.kind, 'lectures')
  assert.equal(definition.patterns, undefined)
  assert.equal(definition.multiple, undefined)

  assert.equal(definition.guide.length, 1)
  const [entry] = definition.guide
  assert.equal(entry.title(), 'Lectures')
  assert.match(entry.description(), /lectures/i)
  assert.equal(typeof entry.icon, 'function')

  const bodies = registers.filter(({ options }) => options.name === 'sidebar.right.pane.tab')
  assert.equal(bodies.length, 1)
  assert.equal(bodies[0].options.key, definition.id)

  const injected = bodies[0].options.inject('session-9')
  assert.equal(injected.sessionId, 'session-9')
  assert.equal(typeof injected.workspaceFiles.list, 'function')
  assert.equal(typeof injected.workspaceFiles.read, 'function')
})

function renderLectures(fixture) {
  const files = fileRemote(fixture)
  const opened = []
  const mounted = mount(undefined, {}, { files })
  const registration = mounted.registers.find(({ options }) => options.name === 'sidebar.right.pane.tab')
  assert.ok(registration, 'the client registers a Lectures body')
  const injected = {
    ...registration.options.inject('session-1'),
    useTabInfo: () => ({
      tab: { actions: { openResource: (address, options) => opened.push([address, options]) } },
    }),
  }
  resetHooks()
  const renderer = createRenderer(registration.component, () => injected)
  return {
    ...mounted,
    files,
    registration,
    opened,
    get tree() { return renderer.tree },
    rerender: () => renderer.render(),
    async settle() {
      for (let turn = 0; turn < 60; turn += 1) {
        await new Promise((resolve) => queueMicrotask(resolve))
      }
      return renderer.tree
    },
  }
}

const headingOf = (section) => textOf(section.props.children.find((child) => child?.type === 'h2'))
const lectureTopics = (tree) => allOfType(tree, 'section').map(headingOf)
const lectureSection = (tree, topic) => allOfType(tree, 'section').find((section) => headingOf(section) === topic)
const lectureLists = (tree, topic) => allOfType(lectureSection(tree, topic), 'ul')
const lectureRows = (tree, topic) => {
  const main = lectureLists(tree, topic)[0]
  return main === undefined ? [] : allOfType(main, 'li').map(textOf)
}
const lectureArchiveRows = (tree, topic) => {
  const archived = lectureLists(tree, topic)[1]
  return archived === undefined ? [] : allOfType(archived, 'li').map(textOf)
}
const lectureFold = (tree, topic) => allOfType(lectureSection(tree, topic), 'button')
  .find(({ props }) => props['aria-expanded'] !== undefined)
const lectureEntry = (tree, topic, number) => allOfType(lectureSection(tree, topic), 'button')
  .find((node) => textOf(node).startsWith(`${number} · `))

const lectureFixture = (overrides = {}) => ({
  dirs: {
    study: ['algebra', 'calculus'],
    'study/algebra': ['book.html', 'diagrams', 'graph.md', 'lectures', 'log.md', 'state.md'],
    'study/algebra/lectures': ['01-sets.md', '02-groups.md', '100-review.md', 'archive', 'book.html'],
    'study/algebra/lectures/archive': ['04-old-sets.md', '50-retired.md'],
    'study/calculus': ['lectures'],
    'study/calculus/lectures': ['10-limits.md'],
  },
  files: {
    'study/algebra/book.html': '<h1>Book</h1>',
    'study/algebra/graph.md': '# Course: Algebra',
    'study/algebra/log.md': '## 2026-10-20\nConcept: Sets',
    'study/algebra/state.md': '| # | Concept |',
    'study/algebra/lectures/book.html': '<h1>Book</h1>',
    'study/algebra/lectures/01-sets.md': [
      '---', 'status: draft', 'concept: 1', '---', '# Sets and Their Laws', '',
    ].join('\n'),
    'study/algebra/lectures/02-groups.md': [
      '---', 'date: 2026-10-28', 'concept: 2', '---', '# Groups and Homomorphisms', '',
    ].join('\n'),
    'study/algebra/lectures/100-review.md': [
      '---', 'date: 2026-11-02', 'concept: 100', '---', '# Review of Groups', '',
    ].join('\n'),
    'study/algebra/lectures/archive/04-old-sets.md': [
      '---', 'date: 2026-08-01', 'concept: 4', '---', '# Old Sets', '',
    ].join('\n'),
    'study/algebra/lectures/archive/50-retired.md': [
      '---', 'date: 2026-09-15', 'concept: 50', '---', '# Retired Group Theory', '',
    ].join('\n'),
    'study/calculus/lectures/10-limits.md': '# Limits\n',
  },
  ...overrides,
})

test('lists the chosen Course and its lectures by Concept number', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'region' && props['aria-label'] === 'Lectures'), true)
  assert.deepEqual(courseSelect(tree).props.children.map(textOf), ['algebra', 'calculus'])
  assert.equal(courseSelect(tree).props.value, 'algebra')
  assert.deepEqual(lectureTopics(tree), ['algebra'])
  assert.deepEqual(lectureRows(tree, 'algebra'), [
    '01 · Sets and Their Laws · Draft',
    '02 · Groups and Homomorphisms · 28 Oct 2026',
    '100 · Review of Groups · 2 Nov 2026',
  ])
  assert.equal(lectureSection(tree, 'calculus'), undefined)
})

test('keeps the Course name in view above a scrolling lecture list', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  assert.equal(tree.props.style.height, '100%')
  const section = lectureSection(tree, 'algebra')
  const [heading, scroller] = section.props.children
  assert.equal(textOf(heading), 'algebra')
  assert.equal(section.props.key, 'algebra')
  assert.equal(scroller.props.style.overflowY, 'auto')
  assert.equal(allOfType(scroller, 'ul').length, 1)
})

test('marks a draft as a draft without a date and a dated lecture with its date', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  const draft = textOf(lectureEntry(tree, 'algebra', '01'))
  assert.equal(draft, '01 · Sets and Their Laws · Draft')
  assert.doesNotMatch(draft, /\d{4}-\d{2}-\d{2}/)

  const dated = textOf(lectureEntry(tree, 'algebra', '02'))
  assert.equal(dated, '02 · Groups and Homomorphisms · 28 Oct 2026')

  const select = courseSelect(tree)
  select.props.onChange({ target: { value: 'calculus' } })
  const switched = await view.settle()

  const plain = textOf(lectureEntry(switched, 'calculus', '10'))
  assert.equal(plain, '10 · Limits')

  // Put the shared selection back for the tests that read the first Course.
  courseSelect(switched).props.onChange({ target: { value: 'algebra' } })
  await view.settle()
})

test('folds archived lectures into a collapsed group that opens on click', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  assert.deepEqual(lectureArchiveRows(tree, 'algebra'), [])
  assert.doesNotMatch(textOf(lectureSection(tree, 'algebra')), /Old Sets|Retired Group Theory/)
  const fold = lectureFold(tree, 'algebra')
  assert.equal(fold.props.type, 'button')
  assert.equal(fold.props['aria-expanded'], false)
  assert.equal(textOf(fold), 'Archived lectures (2)')

  fold.props.onClick()
  const opened = await view.settle()

  assert.equal(lectureFold(opened, 'algebra').props['aria-expanded'], true)
  assert.deepEqual(lectureArchiveRows(opened, 'algebra'), [
    '04 · Old Sets · Archived',
    '50 · Retired Group Theory · Archived',
  ])
  assert.deepEqual(lectureRows(opened, 'algebra'), [
    '01 · Sets and Their Laws · Draft',
    '02 · Groups and Homomorphisms · 28 Oct 2026',
    '100 · Review of Groups · 2 Nov 2026',
  ])
})

test('opens a lecture as a dock tab with its session file address', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  lectureEntry(tree, 'algebra', '02').props.onClick()

  assert.deepEqual(view.opened, [[
    'dsh-resource://file/session/session-1/study/algebra/lectures/02-groups.md',
    undefined,
  ]])
})

test('opens an archived lecture from its archive path', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  lectureFold(tree, 'algebra').props.onClick()
  const opened = await view.settle()
  lectureEntry(opened, 'algebra', '04').props.onClick()

  assert.deepEqual(view.opened, [[
    'dsh-resource://file/session/session-1/study/algebra/lectures/archive/04-old-sets.md',
    undefined,
  ]])
})

test('encodes a lecture file name with a space in the address', async () => {
  const view = renderLectures({
    dirs: { study: ['algebra'], 'study/algebra/lectures': ['05-a b.md'] },
    files: { 'study/algebra/lectures/05-a b.md': '# A Spaced Title\n' },
  })
  const tree = await view.settle()

  lectureEntry(tree, 'algebra', '05').props.onClick()

  assert.equal(encodeURIComponent('05-a b.md'), '05-a%20b.md', 'the pinned literal is the encoder output')
  assert.deepEqual(view.opened, [[
    'dsh-resource://file/session/session-1/study/algebra/lectures/05-a%20b.md',
    undefined,
  ]])
})

test('names the searched folder and the command when the workspace has no study folder', async () => {
  const view = renderLectures({ dirs: {}, files: {} })
  const tree = await view.settle()

  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'region' && props['aria-label'] === 'Lectures'), true)
  assert.deepEqual(allOfType(tree, 'section'), [])
  const lines = allOfType(tree, 'p').map(textOf)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /study\//)
  assert.match(lines[0], /\/study-plus/)
  assert.deepEqual(view.files.calls, [['list', 'session-1', 'study']])
})

test('treats an empty study folder as a different page from a missing one', async () => {
  const view = renderLectures({ dirs: { study: [] }, files: {} })
  const tree = await view.settle()

  assert.deepEqual(allOfType(tree, 'section'), [])
  assert.deepEqual(allOfType(tree, 'li'), [])
  assert.equal(allOfType(tree, 'p').some(({ props }) => /No Tracker in study\//.test(textOf(props))), false)
})

test('gives a Course without lectures its own empty line and no empty list', async () => {
  const view = renderLectures({
    dirs: { study: ['algebra'], 'study/algebra': [] },
    files: {},
  })
  const tree = await view.settle()

  assert.deepEqual(lectureTopics(tree), ['algebra'])
  const section = lectureSection(tree, 'algebra')
  assert.match(textOf(section), /No lectures yet/)
  assert.deepEqual(allOfType(section, 'ul'), [])
  assert.deepEqual(allOfType(section, 'li'), [])
})

test('keeps the empty line off a Course whose only lectures are archived', async () => {
  const view = renderLectures({
    dirs: {
      study: ['algebra'],
      'study/algebra/lectures': ['archive'],
      'study/algebra/lectures/archive': ['04-old-sets.md'],
    },
    files: {
      'study/algebra/lectures/archive/04-old-sets.md': [
        '---', 'date: 2026-08-01', 'concept: 4', '---', '# Old Sets', '',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  const section = lectureSection(tree, 'algebra')
  assert.doesNotMatch(textOf(section), /No lectures yet/)
  assert.doesNotMatch(textOf(section), /Old Sets/)
  assert.equal(textOf(lectureFold(tree, 'algebra')), 'Archived lectures (1)')

  lectureFold(tree, 'algebra').props.onClick()
  const opened = await view.settle()
  assert.deepEqual(allOfType(lectureSection(opened, 'algebra'), 'li').map(textOf), ['04 · Old Sets · Archived'])
})

test('keeps a lecture whose frontmatter will not parse, with no mark', async () => {
  const view = renderLectures({
    dirs: { study: ['algebra'], 'study/algebra/lectures': ['03-broken.md'] },
    files: {
      'study/algebra/lectures/03-broken.md': '---\nthis line is not a field\n---\n# Broken but Listed\n',
    },
  })
  const tree = await view.settle()

  assert.deepEqual(lectureRows(tree, 'algebra'), ['03 · Broken but Listed'])
  assert.equal(textOf(lectureEntry(tree, 'algebra', '03')), '03 · Broken but Listed')
})

test('treats a draft that also carries a teaching date as malformed', async () => {
  const view = renderLectures({
    dirs: { study: ['algebra'], 'study/algebra/lectures': ['03-mixed.md'] },
    files: {
      'study/algebra/lectures/03-mixed.md': [
        '---', 'status: draft', 'date: 2026-10-28', 'concept: 3', '---', '# Mixed Signals', '',
      ].join('\n'),
    },
  })
  const tree = await view.settle()

  assert.deepEqual(lectureRows(tree, 'algebra'), ['03 · Mixed Signals'])
})

test('renders one Lectures region with a button inside a list for each entry', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  const regions = allOfType(tree, 'div')
    .filter(({ props }) => props.role === 'region' && props['aria-label'] === 'Lectures')
  assert.equal(regions.length, 1)
  assert.match(textOf(allOfType(regions[0], 'style')[0]), /outline:2px solid var\(--dsw-alias-state-business-primary, currentColor\)/)

  const rows = allOfType(lectureLists(tree, 'algebra')[0], 'li')
  assert.equal(rows.length, 3)
  for (const row of rows) {
    const buttons = allOfType(row, 'button')
    assert.equal(buttons.length, 1)
    assert.equal(buttons[0].props.type, 'button')
    assert.equal(textOf(buttons[0]), textOf(row))
  }
  assert.equal(textOf(rows[0]), '01 · Sets and Their Laws · Draft')
})

test('leaves the Book and tracker files out of the list', async () => {
  const view = renderLectures(lectureFixture())
  const tree = await view.settle()

  assert.doesNotMatch(textOf(tree), /Book/)
  assert.equal(view.files.calls.some(([, , path]) => /book\.html$|\/(graph|log|state)\.md$/.test(path)), false)
})

test('reads only the lecture folders and each file once', async () => {
  const view = renderLectures(lectureFixture())
  await view.settle()

  const listPaths = view.files.calls.filter(([method]) => method === 'list').map(([, , path]) => path)
  assert.deepEqual(listPaths, [
    'study',
    'study/algebra/lectures',
    'study/algebra/lectures/archive',
  ])
  const reads = view.files.calls.filter(([method]) => method === 'read')
  assert.equal(reads.every(([, , path]) => /^study\/[^/]+\/lectures\/(archive\/)?\d{2,}-.+\.md$/.test(path)), true)
  assert.equal(new Set(reads.map(([, , path]) => path)).size, reads.length)
  assert.equal(view.files.calls.every(([, sessionId]) => sessionId === 'session-1'), true)
})

test('keeps the entries it built when a read fails and names the failure', async () => {
  const view = renderLectures(lectureFixture({
    failures: {
      'study/algebra/lectures/02-groups.md': { code: 'workspace-file/too-large', message: 'the file is too large' },
      'study/algebra/lectures/archive': { code: 'workspace-file/not-directory', message: 'not a folder' },
    },
  }))
  const tree = await view.settle()

  assert.deepEqual(lectureTopics(tree), ['algebra'])
  assert.deepEqual(lectureRows(tree, 'algebra'), [
    '01 · Sets and Their Laws · Draft',
    '100 · Review of Groups · 2 Nov 2026',
  ])

  const alerts = allOfType(tree, 'p').filter(({ props }) => props.role === 'alert')
  assert.equal(alerts.length, 1)
  assert.match(textOf(alerts[0]), /the file is too large/)
  const region = allOfType(tree, 'div')
    .find(({ props }) => props.role === 'region' && props['aria-label'] === 'Lectures')
  const at = region.props.children.indexOf(alerts[0])
  const firstSection = region.props.children.findIndex((child) => child?.type === 'section')
  assert.equal(at >= 0 && at < firstSection, true)
})

test('registers no Lectures seat when the dock registry is absent', () => {
  const { dockTypes, registers } = mount(undefined, {}, { dock: false })
  const has = (name, id) => registers.some(({ options }) => options.name === name && options.id === id)

  assert.deepEqual(dockTypes, [])
  assert.equal(has('conversation.input.left', 'nerd-mode'), true)
  assert.equal(has('settings.section', 'dsh-nerd-mode'), true)
  assert.equal(has('conversation.view', 'study'), true)
})

// --- Course picker -----------------------------------------------------------
// The selection is one module-level binding, so each test here uses Course
// names that no other fixture uses, and the order of these tests matters.

function coursesFixture(names) {
  const dirs = { study: names }
  const files = {}
  for (const name of names) {
    const title = name[0].toUpperCase() + name.slice(1)
    dirs[`study/${name}`] = ['graph.md', 'lectures', 'state.md']
    dirs[`study/${name}/lectures`] = [`01-${name}.md`]
    files[`study/${name}/graph.md`] = [
      `# Course: ${title}`,
      `Book: ${title} Book`,
      GRAPH_HEADER,
      `| 1 | ${name} concept | note | - | 1 | 1 |`,
    ].join('\n')
    files[`study/${name}/state.md`] = [
      STATE_HEADER,
      `| 1 | ${name} concept | new | - | 0 | 0 | |`,
    ].join('\n')
    files[`study/${name}/lectures/01-${name}.md`] = `# ${title} lecture\n`
  }
  return { dirs, files }
}

test('shows a Course picker and the first Course when the workspace has two', async () => {
  const view = renderStudy(coursesFixture(['proportions', 'ratios']))
  const tree = await view.settle()

  const label = allOfType(tree, 'label')[0]
  assert.equal(textOf(label.props.children[0]), 'Course')
  const select = courseSelect(tree)
  assert.deepEqual(select.props.children.map(textOf), ['proportions', 'ratios'])
  assert.equal(select.props.value, 'proportions')
  assert.match(textOf(tree), /Proportions Book/)
  assert.doesNotMatch(textOf(tree), /Ratios Book/)
  const reads = view.files.calls.filter(([method]) => method === 'read')
  assert.equal(reads.every(([, , path]) => path.startsWith('study/proportions/')), true)
})

test('shares one Course selection between the Study tab and the Lectures tab', async () => {
  const lectures = renderLectures(coursesFixture(['proportions', 'ratios']))
  const before = await lectures.settle()

  assert.equal(courseSelect(before).props.value, 'proportions')
  assert.deepEqual(lectureTopics(before), ['proportions'])

  const study = renderStudy(coursesFixture(['proportions', 'ratios']))
  const studyTree = await study.settle()
  courseSelect(studyTree).props.onChange({ target: { value: 'ratios' } })
  const switched = await study.settle()

  assert.match(textOf(switched), /Ratios Book/)
  assert.equal(courseSelect(switched).props.value, 'ratios')

  lectures.rerender()
  const after = await lectures.settle()

  assert.equal(courseSelect(after).props.value, 'ratios')
  assert.deepEqual(lectureTopics(after), ['ratios'])
  assert.deepEqual(lectureRows(after, 'ratios'), ['01 · Ratios lecture'])
  assert.equal(lectureSection(after, 'proportions'), undefined)
})

test('lists the second Course lectures only after the picker selects it', async () => {
  const view = renderLectures(coursesFixture(['statistics', 'probability']))
  const tree = await view.settle()

  assert.equal(courseSelect(tree).props.value, 'probability')
  assert.deepEqual(lectureTopics(tree), ['probability'])
  assert.equal(lectureSection(tree, 'statistics'), undefined)
  assert.equal(view.files.calls.some(([, , path]) => path.includes('/statistics/')), false)

  view.files.calls.length = 0
  courseSelect(tree).props.onChange({ target: { value: 'statistics' } })
  const switched = await view.settle()

  assert.equal(courseSelect(switched).props.value, 'statistics')
  assert.deepEqual(lectureTopics(switched), ['statistics'])
  assert.deepEqual(lectureRows(switched, 'statistics'), ['01 · Statistics lecture'])
  assert.equal(lectureSection(switched, 'probability'), undefined)
  assert.equal(view.files.calls.some(([, , path]) => path.includes('/probability/')), false)
})

test('reads a Course heading and keeps an older Topic heading', async () => {
  const viewFor = (heading) => renderStudy({
    dirs: { study: ['ratios'], 'study/ratios': ['graph.md'] },
    files: {
      'study/ratios/graph.md': [heading, GRAPH_HEADER, '| 1 | Rate | rate | - | 1 | 1 |'].join('\n'),
    },
  })

  const course = await viewFor('# Course: Ratios').settle()
  assert.equal(textOf(allOfType(course, 'h2')[0]), 'Ratios')

  const topic = await viewFor('# Topic: Rates').settle()
  assert.equal(textOf(allOfType(topic, 'h2')[0]), 'Rates')
})

test('gives a Course with no lectures its empty line and reads no other Course', async () => {
  const view = renderLectures({ dirs: { study: ['solo'], 'study/solo': [] }, files: {} })
  const tree = await view.settle()

  assert.deepEqual(lectureTopics(tree), ['solo'])
  assert.match(textOf(lectureSection(tree, 'solo')), /No lectures yet/)
  assert.deepEqual(allOfType(lectureSection(tree, 'solo'), 'ul'), [])
  assert.equal(allOfType(tree, 'select').length, 0)
  assert.equal(view.files.calls.every(([, , path]) => path === 'study' || path.startsWith('study/solo/')), true)
  assert.deepEqual(view.files.calls.filter(([method]) => method === 'read'), [])
})

// --- Study Sessions panel ----------------------------------------------------
// The history route answers `{ phase, done, total, sessions }`; an id's presence
// means Nerd Mode was switched on at least once.

const SESSIONS_API = '/dsh-nerd-mode/api/study-sessions'

function sessionRow(id, title, { cwd, hoursAgo = 1, active } = {}) {
  return {
    id,
    displayTitle: title,
    running: false,
    retainedBy: null,
    blank: false,
    updatedAt: Date.now() - hoursAgo * 3600000,
    ...(cwd === undefined ? {} : { cwd }),
    ...(active === undefined ? {} : { projectionValues: { studyMode: { active } } }),
  }
}

const SESSION_ROWS = [
  sessionRow('s1', 'Gradient descent', { cwd: 'C:\\work\\ml', hoursAgo: 2, active: true }),
  sessionRow('s2', 'Vector spaces', { cwd: 'C:\\work\\math', hoursAgo: 3, active: true }),
  sessionRow('s3', 'Limits', { cwd: 'C:\\work\\calc', hoursAgo: 4, active: false }),
  sessionRow('s4', 'Quiz recap', { cwd: 'C:\\work\\physics', hoursAgo: 5 }),
]

const SESSION_HISTORY = {
  s1: { studyPlus: true },
  s2: { studyPlus: false },
  s3: { studyPlus: true },
  s4: { studyPlus: false },
}

const historyRoute = (sessions = SESSION_HISTORY) => [{
  match: SESSIONS_API,
  respond: jsonResponse({ phase: 'ready', done: 4, total: 4, sessions }),
}]

function renderStudySessions(rows, { routes = [], uiWorkspace } = {}) {
  const mounted = mount(undefined, {}, { uiWorkspace })
  const registration = mounted.registers.find(({ options }) => options.name === 'main')
  assert.ok(registration, 'the client registers a Study Sessions page')
  stubFetch(routes)
  const byId = {}
  for (const row of rows) byId[row.id] = row
  const snapshot = { ids: rows.map(({ id }) => id), byId, phase: 'ready' }
  const injected = registration.options.inject()
  resetHooks()
  const renderer = createRenderer(registration.component, () => ({
    ...injected,
    useSessions: (select) => select(snapshot),
  }))
  return {
    ...mounted,
    registration,
    get tree() { return renderer.tree },
    rerender: () => renderer.render(),
    async settle() {
      for (let turn = 0; turn < 60; turn += 1) {
        await new Promise((resolve) => queueMicrotask(resolve))
      }
      return renderer.tree
    },
  }
}

const headingsOf = (tree) => allOfType(tree, 'h2').map(textOf)
const rowStarting = (tree, text) => allOfType(tree, 'button').find((node) => textOf(node).startsWith(text))

test('renders Quick, In-depth, and a collapsed Past group with counts', async () => {
  const view = renderStudySessions(SESSION_ROWS, { routes: historyRoute() })
  const tree = await view.settle()

  assert.equal(allOfType(tree, 'div').some(({ props }) => props.role === 'region' && props['aria-label'] === 'Study Sessions'), true)
  assert.equal(textOf(allOfType(tree, 'h1')[0]), 'Study Sessions')
  assert.deepEqual(headingsOf(tree), ['Quick (1)', 'In-depth (1)', 'Past (2)'])

  const past = allOfType(tree, 'button').find(({ props }) => props['aria-expanded'] === false)
  assert.ok(past, 'the Past heading is a collapsed control')
  assert.equal(textOf(past), 'Past (2)')
  assert.equal(rowStarting(tree, 'Limits'), undefined)

  assert.equal(
    textOf(rowStarting(tree, 'Vector spaces')),
    'Vector spaces · math · 3 hours ago',
  )
  assert.equal(
    textOf(rowStarting(tree, 'Gradient descent')),
    'Gradient descent · ml · 2 hours ago',
  )

  past.props.onClick()
  const opened = await view.settle()

  assert.equal(textOf(rowStarting(opened, 'Limits')), 'Limits · calc · 4 hours ago · In-depth')
  assert.equal(textOf(rowStarting(opened, 'Quiz recap')), 'Quiz recap · physics · 5 hours ago · Quick')
  assert.equal(allOfType(opened, 'button').find(({ props }) => props['aria-expanded'] === true) !== undefined, true)

  view.locale.switchTo('zh')
  const translated = await view.settle()

  assert.deepEqual(headingsOf(translated), ['快速 (1)', '深入 (1)', '过去 (2)'])
  assert.equal(textOf(rowStarting(translated, 'Vector spaces')), 'Vector spaces · math · 3小时前')
})

test('shows the empty line when no session ever had Nerd Mode', async () => {
  const view = renderStudySessions(SESSION_ROWS, { routes: historyRoute({}), uiWorkspace: false })
  const tree = await view.settle()

  assert.match(textOf(tree), /No study session yet/)
  assert.match(textOf(tree), /\/nerd-mode on/)
  assert.deepEqual(headingsOf(tree), [])
})

test('keeps the cached rows and names the failure when the route fails', async () => {
  const first = renderStudySessions(SESSION_ROWS, { routes: historyRoute() })
  await first.settle()
  assert.match(textOf(first.tree), /Vector spaces/)

  const second = renderStudySessions(SESSION_ROWS)
  const tree = await second.settle()

  assert.match(textOf(tree), /Vector spaces/)
  assert.match(textOf(tree), /Gradient descent/)
  const alerts = allOfType(tree, 'p').filter(({ props }) => props.role === 'alert')
  assert.equal(alerts.length, 1)
  assert.match(textOf(alerts[0]), /The session index could not be read:/)
  assert.match(textOf(alerts[0]), /not available/)
})
