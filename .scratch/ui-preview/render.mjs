// Build a throwaway preview of the plugin's four visible surfaces in three
// visual directions. Preview only: nothing here ships, and every file it writes
// stays inside .scratch/ui-preview/.
//
// Run: node .scratch/ui-preview/render.mjs

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// --- The classic script ------------------------------------------------------

let captured
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }
await import(new URL('../../client.js', import.meta.url).href)
if (captured === undefined) throw new Error('client.js did not call window.__ModuleLoader__.load')

// --- Mini React --------------------------------------------------------------
// Copied from test/client.test.mjs so the preview runs the real components with
// no bundler and no test-file side effects. Effects run during render, and a
// state change schedules one microtask re-render.

const FakeToast = function Toast() {}
let hookInstances = new Map()
let activeHooks
let hookIndex = 0

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
  if (typeof node.type === 'function' && node.type !== FakeToast) {
    return renderComponent(node.type, node.props, renderer)
  }
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
  }
  renderer.render()
  return renderer
}

function start(component, getProps) {
  resetHooks()
  return createRenderer(component, getProps)
}

async function settle(renderer, turns = 80) {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise((resolve) => queueMicrotask(resolve))
  }
  return renderer.tree
}

const textOf = (node) => {
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return node?.props ? textOf(node.props.children) : ''
}

function findAll(node, type) {
  const matches = []
  const visit = (current) => {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!current || typeof current !== 'object') return
    if (current.type === type) matches.push(current)
    visit(current.props?.children)
  }
  visit(node)
  return matches
}

// --- Mock host ---------------------------------------------------------------

const BASE_SETTINGS = Object.freeze({
  recallSessionEnabled: false,
  unseenQuestionCount: 3,
  unseenQuestionType: 'short-answer',
})

function fakeLocale(language = 'en') {
  const snapshot = { active: language, locales: ['en', 'zh'], revision: 0 }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    resolveText: (text) => text[snapshot.active] ?? text.en,
  }
}

function fakeConfigForms() {
  let snapshot = {
    status: 'ready',
    base: { ...BASE_SETTINGS },
    user: {},
    value: { ...BASE_SETTINGS },
    revision: 4,
    writable: true,
  }
  const listeners = new Set()
  const scope = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async mutate(operations) {
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
  const description = {
    getSnapshot: () => ({
      status: 'ready',
      error: null,
      view: { namespaces: [{ ns: 'dsh-nerd-mode' }] },
    }),
    subscribe: () => () => {},
  }
  return {
    get(namespace) {
      if (namespace !== 'dsh-nerd-mode') throw new Error(`unexpected config namespace: ${namespace}`)
      return scope
    },
    describe: () => description,
  }
}

// A stand-in for ctx.remote.workspaceFiles. Directories come from `dirs`, text
// files from `files`. A missing path is a not-found error, as in the host.
function fileRemote({ files = {}, dirs = {} } = {}) {
  const isDirectory = (path, name) => Boolean(dirs[`${path}/${name}`])
    || Object.keys(files).some((key) => key.startsWith(`${path}/${name}/`))
  return {
    async list(sessionId, path) {
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
    async read(sessionId, path) {
      if (!(path in files)) {
        return { ok: false, error: { code: 'workspace-file/not-found', message: `${path} does not exist` } }
      }
      const text = files[path]
      return { ok: true, value: { text, offset: 1, lines: text.split('\n').length, eof: true } }
    },
  }
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const SESSIONS_API = '/dsh-nerd-mode/api/study-sessions'

function stubMarket() {
  globalThis.fetch = async (url) => {
    const target = String(url)
    if (target.includes('/dsh-market/api/v1/capabilities')) {
      return jsonResponse({
        schema: 'dsh-market/update-api/v1',
        features: { update: true, restart: false },
        endpoints: {
          updates: '/dsh-market/api/v1/updates',
          operations: '/dsh-market/api/v1/operations',
        },
        profile: 'default',
      })
    }
    if (target.includes('/dsh-market/api/v1/updates')) {
      return jsonResponse({
        schema: 'dsh-market/update-api/v1',
        package: {
          name: 'dsh-nerd-mode',
          source: 'npm',
          installedVersion: '0.5.0',
          latestVersion: '0.6.0',
          updateAvailable: true,
          channelSwitch: null,
        },
      })
    }
    if (target.includes(SESSIONS_API)) {
      return jsonResponse({
        phase: 'ready',
        done: 6,
        total: 6,
        sessions: {
          s1: { studyPlus: true },
          s2: { studyPlus: true },
          s3: { studyPlus: false },
          s4: { studyPlus: false },
          s5: { studyPlus: true },
          s6: { studyPlus: false },
        },
      })
    }
    return jsonResponse({ error: 'no route' }, 404)
  }
}

// --- Fixtures ----------------------------------------------------------------

const GRAPH = [
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

const STATE = [
  '| # | Concept | State | Last evidence | Passes | Misses | Note |',
  '|---|---|---|---|---|---|---|',
  '| 1 | Loss function | fluent | 2026-10-20 | 1 | 0 | |',
  '| 2 | Gradient | shaky | 2026-10-28 | 0 | 2 | sign flip |',
  '| 3 | Learning rate | shaky | 2026-10-27 | 0 | 1 | too large |',
  '| 4 | Momentum | new | - | 0 | 0 | |',
].join('\n')

const LOG = [
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

const studyFiles = fileRemote({
  dirs: {
    study: ['gradient-descent', 'linear-algebra'],
    'study/gradient-descent': ['graph.md', 'log.md', 'state.md'],
    'study/linear-algebra': ['graph.md'],
  },
  files: {
    'study/gradient-descent/graph.md': GRAPH,
    'study/gradient-descent/log.md': LOG,
    'study/gradient-descent/state.md': STATE,
    'study/linear-algebra/graph.md': '# Course: linear-algebra\n\n| # | Concept | Chapter | Section |\n|---|---|---|---:|\n| 1 | Span | 1 | 1 |',
  },
})

const lectureFiles = fileRemote({
  dirs: {
    study: ['algebra', 'calculus'],
    'study/algebra': ['graph.md', 'lectures', 'log.md', 'state.md'],
    'study/algebra/lectures': ['01-vector-spaces.md', '02-linear-maps.md', '03-eigenvalues.md', 'archive'],
    'study/algebra/lectures/archive': ['04-old-bases.md', '05-retired.md'],
    'study/calculus': ['lectures'],
    'study/calculus/lectures': ['10-limits.md'],
  },
  files: {
    'study/algebra/graph.md': '# Course: algebra',
    'study/algebra/state.md': '| # | Concept |',
    'study/algebra/lectures/01-vector-spaces.md': ['---', 'status: draft', 'concept: 1', '---', '# Vector Spaces and Subspaces', ''].join('\n'),
    'study/algebra/lectures/02-linear-maps.md': ['---', 'date: 2026-11-04', 'concept: 2', '---', '# Linear Maps and Matrices', ''].join('\n'),
    'study/algebra/lectures/03-eigenvalues.md': ['---', 'date: 2026-11-08', 'concept: 3', '---', '# Eigenvalues and Eigenvectors', ''].join('\n'),
    'study/algebra/lectures/archive/04-old-bases.md': ['---', 'date: 2026-09-20', 'concept: 4', '---', '# Change of Basis, old notes', ''].join('\n'),
    'study/algebra/lectures/archive/05-retired.md': ['---', 'date: 2026-09-28', 'concept: 5', '---', '# Retired: Jordan Form', ''].join('\n'),
    'study/calculus/lectures/10-limits.md': '# Limits\n',
  },
})

const SESSION_ROWS = [
  { id: 's1', title: 'Gradient descent from first principles', cwd: 'C:\\work\\ml-notes', hoursAgo: 2, active: true },
  { id: 's2', title: 'Vector spaces and subspaces', cwd: 'C:\\work\\linear-algebra', hoursAgo: 5, active: true },
  { id: 's3', title: 'Limits and continuity', cwd: 'C:\\work\\calculus', hoursAgo: 26, active: true },
  { id: 's4', title: 'Probability warm-up', cwd: 'C:\\work\\stats', hoursAgo: 50, active: true },
  { id: 's5', title: 'Quiz recap: derivatives', cwd: 'C:\\work\\calculus', hoursAgo: 96, active: false },
  { id: 's6', title: 'Eigenvalues review', cwd: 'C:\\work\\ml-notes', hoursAgo: 150, active: false },
]

// --- Host context ------------------------------------------------------------

function mountClient(workspaceFiles) {
  const registers = []
  const dockTypes = []
  const configForms = fakeConfigForms()
  const locale = fakeLocale(process.env.PREVIEW_LOCALE ?? 'en')
  const ctx = {
    effect(fn) {
      return fn()
    },
    get(name) {
      return name.split('.').reduce((value, key) => value?.[key], ctx)
    },
    inject(deps, callback) {
      const has = (name) => name.split('.').reduce((value, key) => value?.[key], ctx) !== undefined
      if (deps.every(has)) callback(ctx)
      return () => {}
    },
    sidebarRightTabs: {
      register(definition) {
        dockTypes.push(definition)
        return () => {}
      },
    },
    uiWorkspace: { openSession() {} },
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
      commands: { async execute() { return { ok: true, value: {} } } },
      workspaceFiles,
    },
    configForms,
    locale,
  }
  client.apply(ctx)
  return { registers, dockTypes }
}

function registrationFor(mounted, name) {
  const found = mounted.registers.find(({ options }) => options.name === name)
  if (found === undefined) throw new Error(`the client did not register ${name}`)
  return found
}

stubMarket()

// --- Surfaces ----------------------------------------------------------------

async function buildSettings() {
  const mounted = mountClient(studyFiles)
  const surface = registrationFor(mounted, 'settings.section')
  const renderer = start(surface.component, () => ({ close() {} }))
  await settle(renderer)

  // Make the section representative: change all three controls, save once, and
  // leave the saved status line visible. This drives the real handlers.
  findAll(renderer.tree, 'input')
    .find(({ props }) => props['data-setting'] === 'unseenQuestionCount')
    .props.onChange({ target: { value: '6' } })
  await settle(renderer)

  findAll(renderer.tree, 'select')
    .find(({ props }) => props['data-setting'] === 'unseenQuestionType')
    .props.onChange({ target: { value: 'mixed' } })
  await settle(renderer)

  findAll(renderer.tree, 'button')
    .find(({ props }) => props['data-setting'] === 'recallSessionEnabled')
    .props.onClick()
  await settle(renderer)

  const save = findAll(renderer.tree, 'button').find(({ props }) => ['Save', '保存'].includes(textOf(props.children)))
  if (save === undefined) throw new Error('the settings footer has no Save button')
  await save.props.onClick()
  await settle(renderer)
  return renderer.tree
}

async function buildStudy() {
  const mounted = mountClient(studyFiles)
  const surface = registrationFor(mounted, 'conversation.view')
  const injected = surface.options.inject('session-preview')
  const renderer = start(surface.component, () => injected)
  return settle(renderer)
}

async function buildLectures() {
  const mounted = mountClient(lectureFiles)
  const surface = registrationFor(mounted, 'sidebar.right.pane.tab')
  const injected = {
    ...surface.options.inject('session-preview'),
    useTabInfo: () => ({ tab: { actions: { openResource() {} } } }),
  }
  const renderer = start(surface.component, () => injected)
  return settle(renderer)
}

async function buildSessions() {
  const mounted = mountClient(studyFiles)
  const surface = registrationFor(mounted, 'main')
  const injected = surface.options.inject()
  const now = Date.now()
  const byId = Object.fromEntries(SESSION_ROWS.map((row) => [row.id, {
    id: row.id,
    displayTitle: row.title,
    running: false,
    retainedBy: null,
    blank: false,
    updatedAt: now - row.hoursAgo * 3600000,
    cwd: row.cwd,
    projectionValues: { studyMode: { active: row.active } },
  }]))
  const snapshot = { ids: SESSION_ROWS.map(({ id }) => id), byId, phase: 'ready' }
  const renderer = start(surface.component, () => ({
    ...injected,
    useSessions: (select) => select(snapshot),
  }))
  await settle(renderer)

  // Past starts folded; open it so the mode chips and both past rows are shown.
  const past = findAll(renderer.tree, 'button')
    .find(({ props }) => /^(Past|过去) \d/.test(props['aria-label'] ?? ''))
  if (past === undefined) throw new Error('the sessions page has no Past group')
  past.props.onClick()
  await settle(renderer)
  return renderer.tree
}

const settingsTree = await buildSettings()
const studyTree = await buildStudy()
const lecturesTree = await buildLectures()
const sessionsTree = await buildSessions()

// --- Serializer --------------------------------------------------------------
// inferRole reads only what the component already exposes: the tag, className,
// aria role, inline style, and the parent's role. It names intent, so the
// three direction tables below can target the same list. No component changes.

const ROW_CLASSES = ['study-ss-row', 'lectures-row']
const ROW_LIST_CLASSES = ['study-ss-rows', 'lectures-rows']
const isClass = (cls, name) => cls.split(/\s+/).includes(name)

function inferRole(node, parentRole) {
  const props = node?.props ?? {}
  const tag = node?.type
  const cls = typeof props.className === 'string' ? props.className : ''
  const style = props.style ?? {}

  if (tag === 'style') return 'raw-style'
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return 'field'
  if (tag === 'option') return 'option'

  if (tag === 'button') {
    if (props.role === 'switch') return 'switch'
    if (ROW_CLASSES.some((name) => isClass(cls, name))) return 'row'
    if (isClass(cls, 'study-ss-fold') || isClass(cls, 'lectures-fold')) return 'fold'
    if (style.fontWeight === 600) return 'action-primary'
    return 'action'
  }

  if (tag === 'a') return 'action'
  if (tag === 'h1') return 'title'
  if (tag === 'h2') {
    if (isClass(cls, 'study-ss-group-title') || isClass(cls, 'lectures-group-title')) return 'heading'
    return 'title'
  }
  if (tag === 'h3') return 'heading'
  if (tag === 'footer') return 'footer'
  if (tag === 'code') return 'code'
  if (tag === 'dl') return 'strip'
  if (tag === 'dt') return 'strip-label'
  if (tag === 'dd') return 'strip-value'
  if (tag === 'ul') return ROW_LIST_CLASSES.some((name) => isClass(cls, name)) ? 'row-list' : 'list'
  if (tag === 'li') return 'list-item'

  if (tag === 'label') {
    return style.flexDirection === 'column' ? 'field-label' : 'field-inline'
  }

  if (tag === 'section') {
    if (isClass(cls, 'lectures-group')) return 'page-section'
    if (isClass(cls, 'study-ss-group')) return 'session-group'
    if (props['data-study-section'] !== undefined) return 'section'
    if (props['data-settings-group'] !== undefined && typeof style.background === 'string') return 'setting-group'
    return 'stack'
  }

  if (tag === 'header') {
    if (isClass(cls, 'lectures-head')) return 'lectures-head'
    if (isClass(cls, 'study-ss-head')) return 'page-head'
    return 'stack'
  }

  if (tag === 'span') {
    if (isClass(cls, 'lectures-tile') || isClass(cls, 'study-ss-tile')) return 'tile'
    if (isClass(cls, 'lectures-chip') || isClass(cls, 'study-ss-chip')) return 'chip'
    if (isClass(cls, 'lectures-count') || isClass(cls, 'study-ss-count')) return 'count'
    if (isClass(cls, 'lectures-title') || isClass(cls, 'study-ss-title')) return 'row-title'
    if (isClass(cls, 'lectures-meta') || isClass(cls, 'study-ss-meta')
      || isClass(cls, 'study-ss-workspace') || isClass(cls, 'study-ss-time')) return 'meta'
    if (style.fontSize === 12) return 'hint'
    return 'text'
  }

  if (tag === 'p') {
    if (isClass(cls, 'study-ss-empty') || isClass(cls, 'lectures-empty')) return 'empty'
    if (isClass(cls, 'study-ss-intro')) return 'page-intro'
    const children = Array.isArray(props.children) ? props.children : []
    if (children.some((child) => child?.props?.style?.fontSize === 28)) return 'figure-row'
    return 'note'
  }

  if (tag === 'div') {
    if (props['data-nerd-mode-settings'] !== undefined) return 'settings-root'
    if (props.role === 'region') {
      if (isClass(cls, 'lectures-page')) return 'lectures-root'
      if (isClass(cls, 'study-ss-page')) return 'sessions-root'
      if (props['aria-label'] === 'Study') return 'study-root'
    }
    if (props.role === 'progressbar' || isClass(cls, 'study-ss-track')) return 'track'
    if (parentRole === 'track') return 'track-fill'
    if (parentRole === 'strip') return 'strip-cell'
    if (isClass(cls, 'lectures-scroll')) return 'scroll'
    if (isClass(cls, 'lectures-group-head')) return 'section-head'
    if (style.justifyContent === 'flex-end') return 'actions'
    // The About card has no data attribute, so its shape names it: a filled,
    // bordered, rounded block with padding and a heading inside.
    const looksLikeGroup = typeof style.background === 'string'
      && typeof style.border === 'string'
      && typeof style.borderRadius === 'string'
      && style.padding !== undefined
    if (props['data-settings-group'] !== undefined && typeof style.background === 'string') return 'setting-group'
    if (looksLikeGroup) return 'setting-group'
    if (style.fontSize === 28) return 'figure'
    return 'stack'
  }

  if (tag === 'svg') return 'icon'
  return 'text'
}

const UNITLESS = new Set([
  'aspectRatio', 'columnCount', 'flex', 'flexGrow', 'flexShrink', 'fontWeight',
  'gridColumn', 'gridRow', 'lineHeight', 'opacity', 'order', 'tabSize', 'zIndex',
])

const ATTR_NAMES = {
  className: 'class',
  htmlFor: 'for',
  inputMode: 'inputmode',
  readOnly: 'readonly',
  tabIndex: 'tabindex',
  viewBox: 'viewBox',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
}

const BOOLEAN_ATTRS = new Set([
  'checked', 'disabled', 'hidden', 'open', 'readOnly', 'required', 'selected',
])

const VOID_TAGS = new Set(['input', 'br', 'hr', 'img'])

const escapeText = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function cssProp(key) {
  if (key.startsWith('--')) return key
  if (key === 'cssFloat') return 'float'
  if (key.startsWith('Webkit')) return `-webkit-${key.slice(6).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
  if (key.startsWith('ms')) return `-ms-${key.slice(2).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

function cssValue(key, value) {
  if (typeof value === 'number') {
    if (value === 0) return '0'
    return UNITLESS.has(key) ? String(value) : `${value}px`
  }
  return String(value)
}

function styleText(style) {
  if (style === undefined || style === null) return ''
  const parts = []
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === false) continue
    parts.push(`${cssProp(key)}:${cssValue(key, value)}`)
  }
  return parts.length === 0 ? '' : ` style="${escapeAttr(parts.join(';'))}"`
}

// Replace patched keys in place so their declarations come after any base
// shorthand they must beat (for example `border` then `border-top`).
function mergeStyle(base, patch) {
  const merged = { ...(base ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    delete merged[key]
    merged[key] = value
  }
  return merged
}

const collectedStyles = new Set()

function attrText(node, role, style, selectValue) {
  const props = node.props ?? {}
  const parts = [`data-ui-role="${role}"`]
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'style' || key === 'key' || key.startsWith('on')) continue
    if (key === 'value' && node.type === 'select') continue
    const name = ATTR_NAMES[key] ?? key
    if (value === undefined || value === null) continue
    if (value === false) {
      if (BOOLEAN_ATTRS.has(key)) continue
      parts.push(`${name}="false"`)
      continue
    }
    if (value === true) {
      if (BOOLEAN_ATTRS.has(key)) parts.push(name)
      else parts.push(`${name}="true"`)
      continue
    }
    parts.push(`${name}="${escapeAttr(String(value))}"`)
  }
  if (node.type === 'option'
    && selectValue !== undefined
    && String(props.value) === String(selectValue)) {
    parts.push('selected')
  }
  const styles = styleText(style)
  if (styles !== '') parts.push(styles.trim())
  return ` ${parts.join(' ')}`
}

function serializeNode(node, direction, parentRole = undefined, selectValue = undefined) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return escapeText(String(node))
  if (Array.isArray(node)) {
    return node.map((child) => serializeNode(child, direction, parentRole, selectValue)).join('')
  }
  if (node.type === React.Fragment) {
    return serializeNode(node.props.children, direction, parentRole, selectValue)
  }
  if (node.type === 'style') {
    collectedStyles.add(textOf(node.props.children))
    return ''
  }

  const role = inferRole(node, parentRole)
  const patch = direction.roles[role]
  const style = patch === undefined ? node.props.style : mergeStyle(node.props.style, patch)
  const chosen = node.type === 'select'
    ? node.props.value
    : node.type === 'option' ? selectValue : undefined
  const attrs = attrText(node, role, style, chosen)
  const inner = serializeNode(node.props.children, direction, role, chosen)
  if (VOID_TAGS.has(node.type)) return `<${node.type}${attrs}>`
  return `<${node.type}${attrs}>${inner}</${node.type}>`
}

// --- Direction tables --------------------------------------------------------
// Each table is a role -> inline style patch. Values are host tokens. The
// Astryx palette is defined separately as literal variables, preview only.

const LEDGER = {
  id: 'ledger',
  index: '01',
  name: 'Ledger',
  palette: 'host',
  rationale: 'Hairline groups and tight rows: the page reads like a study log.',
  roles: {
    'settings-root': { gap: '16px', padding: '24px' },
    'study-root': { gap: '16px', padding: '24px' },
    'lectures-root': { padding: '24px' },
    'sessions-root': { gap: '24px', padding: '0 24px 24px' },
    title: { fontSize: '15px', lineHeight: '22px', fontWeight: 600 },
    heading: { fontSize: '13px', lineHeight: '18px', fontWeight: 600 },
    note: { fontSize: '12px', lineHeight: '18px' },
    'figure-row': { lineHeight: '24px', margin: 0 },
    figure: { fontSize: '15px', lineHeight: '24px', fontWeight: 600 },
    'setting-group': {
      background: 'transparent',
      border: '0',
      borderTop: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '0',
      padding: '16px 0 0',
      gap: '12px',
    },
    'field-label': { gap: '6px', fontSize: '12px', fontWeight: 600 },
    'field-inline': { fontSize: '12px' },
    field: { height: '32px', borderRadius: '6px', fontSize: '13px', padding: '0 8px' },
    hint: { fontSize: '12px', lineHeight: '16px' },
    footer: { paddingTop: '16px' },
    actions: { marginLeft: 'auto' },
    action: { minHeight: '32px', borderRadius: '6px', padding: '0 12px', fontSize: '13px', fontWeight: 500 },
    'action-primary': { minHeight: '32px', borderRadius: '6px', padding: '0 12px', fontSize: '13px', fontWeight: 600 },
    switch: { minHeight: '32px', minWidth: '72px', borderRadius: '6px', fontSize: '13px', marginLeft: 'auto' },
    code: { fontSize: '12px' },
    section: { gap: '8px' },
    list: { gap: '4px' },
    'row-list': { gap: '0' },
    'list-item': { margin: '0' },
    strip: { gap: '8px' },
    'strip-cell': { padding: '8px 12px', borderRadius: '6px' },
    'strip-label': { fontSize: '12px' },
    'strip-value': { fontSize: '13px' },
    track: { height: '6px', borderRadius: '6px' },
    'track-fill': { background: 'var(--dsw-alias-state-business-primary)' },
    row: {
      padding: '8px 4px',
      borderRadius: '0',
      borderTop: '1px solid var(--dsw-alias-border-l2)',
    },
    'row-title': { fontSize: '13px', lineHeight: '18px', fontWeight: 600 },
    tile: { width: '24px', height: '24px', borderRadius: '6px', fontSize: '12px' },
    meta: { fontSize: '12px', lineHeight: '16px' },
    chip: { fontSize: '12px', lineHeight: '16px', height: '20px', borderRadius: '6px', padding: '0 6px' },
    count: { fontSize: '12px' },
    fold: { fontSize: '13px', lineHeight: '18px', fontWeight: 600 },
    empty: { fontSize: '13px', padding: '32px 12px' },
    'page-head': { paddingTop: '24px' },
    'page-intro': { fontSize: '12px', lineHeight: '18px' },
    'page-section': { gap: '8px' },
    'lectures-head': { padding: '0 0 16px' },
    'section-head': { padding: '16px 0 8px' },
    scroll: { padding: '0' },
    'session-group': { gap: '8px' },
  },
  css: `
    [data-direction="ledger"] .study-ss-row { grid-template-columns: 24px minmax(0, 1fr) auto; }
    [data-direction="ledger"] .lectures-row { grid-template-columns: 24px minmax(0, 1fr); }
    [data-direction="ledger"] [data-ui-role="list-item"]:first-child [data-ui-role="row"] { border-top: 0 !important; }
  `,
}

const CARD = {
  id: 'card',
  index: '02',
  name: 'Card',
  palette: 'host',
  rationale: 'Each setting is a card you can pick up; padding and gaps carry the calm.',
  roles: {
    'settings-root': { gap: '24px', padding: '32px' },
    'study-root': { gap: '24px', padding: '32px' },
    'lectures-root': { padding: '32px' },
    'sessions-root': { gap: '32px', padding: '0 32px 32px' },
    title: { fontSize: '15px', lineHeight: '24px', fontWeight: 600 },
    heading: { fontSize: '15px', lineHeight: '22px', fontWeight: 600 },
    note: { fontSize: '13px', lineHeight: '20px' },
    'figure-row': { lineHeight: '24px', margin: 0 },
    figure: { fontSize: '15px', lineHeight: '24px', fontWeight: 600 },
    'setting-group': {
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '10px',
      padding: '24px',
      gap: '16px',
    },
    'field-label': { gap: '8px', fontSize: '13px', fontWeight: 500 },
    'field-inline': { fontSize: '13px' },
    field: { height: '32px', borderRadius: '6px', fontSize: '13px', padding: '0 10px' },
    hint: { fontSize: '12px', lineHeight: '18px' },
    footer: { paddingTop: '24px' },
    actions: { marginLeft: 'auto' },
    action: { minHeight: '32px', borderRadius: '10px', padding: '0 12px', fontSize: '13px', fontWeight: 500 },
    'action-primary': { minHeight: '32px', borderRadius: '10px', padding: '0 12px', fontSize: '13px', fontWeight: 600 },
    switch: { minHeight: '32px', minWidth: '76px', borderRadius: '10px', fontSize: '13px', marginLeft: 'auto' },
    code: { fontSize: '12px' },
    section: { gap: '12px' },
    list: { gap: '8px' },
    'row-list': { gap: '8px' },
    'list-item': { margin: '0' },
    strip: { gap: '12px' },
    'strip-cell': { padding: '12px 16px', borderRadius: '10px' },
    'strip-label': { fontSize: '12px' },
    'strip-value': { fontSize: '13px' },
    track: { height: '8px', borderRadius: '6px' },
    'track-fill': { background: 'var(--dsw-alias-state-business-primary)' },
    row: {
      padding: '10px 12px',
      borderRadius: '10px',
      background: 'var(--dsw-alias-bg-layer-1)',
    },
    'row-title': { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
    tile: { width: '32px', height: '32px', borderRadius: '10px', fontSize: '12px' },
    meta: { fontSize: '12px', lineHeight: '18px' },
    chip: { fontSize: '12px', lineHeight: '16px', height: '20px', borderRadius: '6px', padding: '0 8px' },
    count: { fontSize: '12px' },
    fold: { fontSize: '15px', lineHeight: '22px', fontWeight: 600 },
    empty: { fontSize: '13px', padding: '32px 16px' },
    'page-head': { paddingTop: '32px' },
    'page-intro': { fontSize: '13px', lineHeight: '20px' },
    'page-section': { gap: '12px' },
    'lectures-head': { padding: '0 0 16px' },
    'section-head': { padding: '16px 0 12px' },
    scroll: { padding: '0' },
    'session-group': { gap: '12px' },
  },
  css: `
    [data-direction="card"] .lectures-row { grid-template-columns: 32px minmax(0, 1fr); }
    [data-direction="card"] [data-ui-role="row"]:hover { background: var(--dsw-alias-interactive-bg-hover) !important; }
  `,
}

const ASTRYX = {
  id: 'astryx',
  index: '03',
  name: 'Astryx',
  palette: 'astryx',
  rationale: 'The Astryx neutral palette in one framed sheet, with quiet internal rules.',
  roles: {
    'settings-root': { gap: '24px', padding: '24px' },
    'study-root': { gap: '24px', padding: '24px' },
    'lectures-root': { padding: '24px' },
    'sessions-root': { gap: '24px', padding: '0 24px 24px' },
    title: { fontSize: '15px', lineHeight: '24px', fontWeight: 500 },
    heading: { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
    note: { fontSize: '13px', lineHeight: '20px' },
    'figure-row': { lineHeight: '24px', margin: 0 },
    figure: { fontSize: '15px', lineHeight: '24px', fontWeight: 500 },
    'setting-group': {
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '6px',
      padding: '12px 16px',
      gap: '16px',
    },
    'field-label': { gap: '8px', fontSize: '13px', fontWeight: 400 },
    'field-inline': { fontSize: '13px' },
    field: { height: '32px', borderRadius: '6px', fontSize: '13px', padding: '0 8px' },
    hint: { fontSize: '12px', lineHeight: '18px' },
    footer: { paddingTop: '16px' },
    actions: { marginLeft: 'auto' },
    action: { minHeight: '32px', borderRadius: '6px', padding: '0 12px', fontSize: '13px', fontWeight: 500 },
    'action-primary': {
      minHeight: '32px',
      borderRadius: '6px',
      padding: '0 12px',
      fontSize: '13px',
      fontWeight: 500,
      background: 'var(--dsw-alias-state-business-primary)',
      borderColor: 'var(--dsw-alias-state-business-primary)',
      color: 'var(--dsw-alias-bg-layer-1)',
    },
    switch: { minHeight: '32px', minWidth: '72px', borderRadius: '6px', fontSize: '13px', marginLeft: 'auto' },
    code: { fontSize: '12px' },
    section: { gap: '8px' },
    list: { gap: '4px' },
    'row-list': {
      gap: '0',
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '6px',
      padding: '4px',
    },
    'list-item': { margin: '0' },
    strip: { gap: '8px' },
    'strip-cell': { padding: '8px 12px', borderRadius: '6px' },
    'strip-label': { fontSize: '12px' },
    'strip-value': { fontSize: '13px' },
    track: { height: '6px', borderRadius: '6px' },
    'track-fill': { background: 'var(--dsw-alias-state-business-primary)' },
    row: {
      padding: '8px 12px',
      borderRadius: '6px',
      borderTop: '1px solid var(--dsw-alias-border-l2)',
    },
    'row-title': { fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
    tile: { width: '28px', height: '28px', borderRadius: '6px', fontSize: '12px' },
    meta: { fontSize: '12px', lineHeight: '18px' },
    chip: { fontSize: '12px', lineHeight: '16px', height: '20px', borderRadius: '6px', padding: '0 8px' },
    count: { fontSize: '12px' },
    fold: { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
    empty: { fontSize: '13px', padding: '32px 16px' },
    'page-head': { paddingTop: '24px' },
    'page-intro': { fontSize: '13px', lineHeight: '20px' },
    'page-section': { gap: '8px' },
    'lectures-head': { padding: '0 0 16px' },
    'section-head': { padding: '16px 0 8px' },
    scroll: { padding: '0' },
    'session-group': { gap: '8px' },
  },
  css: `
    [data-direction="astryx"] .study-ss-row { grid-template-columns: 28px minmax(0, 1fr) auto; }
    [data-direction="astryx"] [data-ui-role="list-item"]:first-child [data-ui-role="row"] { border-top: 0 !important; }
  `,
}

// No overrides: this column shows exactly what client.js ships after the port.
const SHIPPED = {
  id: 'shipped',
  index: '00',
  name: 'Shipped',
  palette: 'host',
  rationale: 'The real client.js. No role overrides applied.',
  roles: {},
  css: '',
}

const DIRECTIONS = [SHIPPED, LEDGER, CARD, ASTRYX]

// --- Palette ----------------------------------------------------------------
// Host values are stand-ins for the DSH theme, read through --dsw-* tokens.
// Astryx values are copied from @astryxdesign/theme-neutral@0.7.13 and live in
// this preview only. No shipped file reads them.

const PALETTES = {
  host: {
    light: {
      '--dsw-alias-bg-layer-1': '#ffffff',
      '--dsw-alias-bg-layer-2': '#f4f6f8',
      '--dsw-alias-label-primary': '#191c20',
      '--dsw-alias-label-secondary': '#4e555e',
      '--dsw-alias-label-tertiary': '#667080',
      '--dsw-alias-border-l2': '#e4e7eb',
      '--dsw-alias-border-l3': '#cbd1d8',
      '--dsw-alias-state-business-primary': '#2d6cdf',
      '--dsw-alias-state-business-tertiary': '#e8effc',
      '--dsw-alias-state-error-primary': '#c23b3b',
      '--dsw-alias-fill-tsp-secondary': 'rgb(25 28 32 / 6%)',
      '--dsw-alias-interactive-bg-hover': 'rgb(25 28 32 / 5%)',
      '--dsw-focus-ring-color': '#2d6cdf',
      '--dsw-font-family': '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
    dark: {
      '--dsw-alias-bg-layer-1': '#1b1e23',
      '--dsw-alias-bg-layer-2': '#14171a',
      '--dsw-alias-label-primary': '#edf0f3',
      '--dsw-alias-label-secondary': '#b2b9c2',
      '--dsw-alias-label-tertiary': '#828b96',
      '--dsw-alias-border-l2': '#2a2e35',
      '--dsw-alias-border-l3': '#3b414a',
      '--dsw-alias-state-business-primary': '#7aa7ff',
      '--dsw-alias-state-business-tertiary': '#1c2942',
      '--dsw-alias-state-error-primary': '#ff8a80',
      '--dsw-alias-fill-tsp-secondary': 'rgb(237 240 243 / 7%)',
      '--dsw-alias-interactive-bg-hover': 'rgb(237 240 243 / 6%)',
      '--dsw-focus-ring-color': '#7aa7ff',
      '--dsw-font-family': '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
  },
  astryx: {
    light: {
      '--dsw-alias-bg-layer-1': '#ffffff',
      '--dsw-alias-bg-layer-2': '#f1f1f1',
      '--dsw-alias-label-primary': '#000000',
      '--dsw-alias-label-secondary': '#474747',
      '--dsw-alias-label-tertiary': '#6a6a6a',
      '--dsw-alias-border-l2': '#00000014',
      '--dsw-alias-border-l3': '#d4d4d4',
      '--dsw-alias-state-business-primary': '#1b1b1b',
      '--dsw-alias-state-business-tertiary': '#d4d4d4',
      '--dsw-alias-state-error-primary': '#c0262c',
      '--dsw-alias-fill-tsp-secondary': '#0000000F',
      '--dsw-alias-interactive-bg-hover': '#0000000D',
      '--dsw-focus-ring-color': '#1b1b1b',
      '--dsw-font-family': 'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    dark: {
      '--dsw-alias-bg-layer-1': '#262626',
      '--dsw-alias-bg-layer-2': '#1b1b1b',
      '--dsw-alias-label-primary': '#ffffff',
      '--dsw-alias-label-secondary': '#c6c6c6',
      '--dsw-alias-label-tertiary': '#9e9e9e',
      '--dsw-alias-border-l2': '#ffffff1A',
      '--dsw-alias-border-l3': '#525252',
      '--dsw-alias-state-business-primary': '#f1f1f1',
      '--dsw-alias-state-business-tertiary': '#474747',
      '--dsw-alias-state-error-primary': '#ffaea7',
      '--dsw-alias-fill-tsp-secondary': '#ffffff1A',
      '--dsw-alias-interactive-bg-hover': '#ffffff0D',
      '--dsw-focus-ring-color': '#f1f1f1',
      '--dsw-font-family': 'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  },
}

function tokenBlock(palette, theme) {
  const tokens = Object.entries(PALETTES[palette][theme])
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
  return `.direction[data-palette="${palette}"][data-theme="${theme}"]{${tokens};color-scheme:${theme}}`
}

// --- Page --------------------------------------------------------------------

const markup = {}
for (const direction of DIRECTIONS) {
  markup[direction.id] = {
    settings: serializeNode(settingsTree, direction),
    study: serializeNode(studyTree, direction),
    lectures: serializeNode(lecturesTree, direction),
    sessions: serializeNode(sessionsTree, direction),
  }
}

const SURFACES = [
  { key: 'settings', title: 'Settings section', slot: 'settings.section' },
  { key: 'study', title: 'Study view', slot: 'conversation.view' },
  { key: 'lectures', title: 'Lectures pane', slot: 'sidebar.right.pane.tab', height: 380 },
  { key: 'sessions', title: 'Study Sessions page', slot: 'main' },
]

function blocksFor(direction) {
  return SURFACES.map(({ key, title, slot, height }) => `
      <section class="surface-block">
        <div class="block-head">
          <h3 class="block-title">${escapeText(title)}</h3>
          <span class="block-slot">${escapeText(slot)}</span>
        </div>
        <div class="surface-frame${height ? ` is-tall" style="height:${height}px` : ''}">${markup[direction.id][key]}</div>
      </section>`).join('')
}

function directionFor(direction) {
  return `
  <section class="direction" id="dir-${direction.id}" data-direction="${direction.id}" data-palette="${direction.palette}" data-theme="light" aria-labelledby="name-${direction.id}">
    <header class="direction-head">
      <div class="direction-name-row">
        <span class="direction-index">${direction.index}</span>
        <h2 class="direction-name" id="name-${direction.id}">${escapeText(direction.name)}</h2>
      </div>
      <p class="direction-rationale">${escapeText(direction.rationale)}</p>
      <div class="theme-switch" role="group" aria-label="Theme for ${escapeText(direction.name)}">
        <button class="theme-btn" type="button" data-theme="light" aria-pressed="true">Light</button>
        <button class="theme-btn" type="button" data-theme="dark" aria-pressed="false">Dark</button>
      </div>
    </header>
    <div class="direction-preview">${blocksFor(direction)}
    </div>
  </section>`
}

const pageCss = `
  :root {
    --paper: #e9e7e1;
    --paper-raised: #f5f3ed;
    --ink: #20211f;
    --ink-soft: #5b5c57;
    --ink-faint: #7c7d76;
    --rule: #d5d2c9;
    --serif: Georgia, "Iowan Old Style", "Times New Roman", serif;
    --sans: "Segoe UI", system-ui, -apple-system, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html { background: var(--paper); }
  body {
    margin: 0;
    color: var(--ink);
    background-color: var(--paper);
    background-image: radial-gradient(circle at 1px 1px, rgb(32 33 31 / 3%) 1px, transparent 0);
    background-size: 6px 6px;
    font-family: var(--sans);
    font-size: 13px;
    line-height: 20px;
    -webkit-font-smoothing: antialiased;
  }
  .masthead {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px 24px;
    padding: 12px 32px;
    background: color-mix(in srgb, var(--paper-raised) 92%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--rule);
  }
  .brand { display: flex; align-items: baseline; gap: 10px; margin-right: auto; }
  .brand-mark {
    font-family: var(--serif);
    font-size: 18px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .brand-kicker {
    font-size: 12px;
    line-height: 16px;
    color: var(--ink-faint);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tabs { display: flex; align-items: center; gap: 2px; }
  .tab {
    appearance: none;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 6px 6px 0 0;
    background: transparent;
    color: var(--ink-soft);
    font: inherit;
    font-size: 13px;
    line-height: 20px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .tab:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent); }
  .tab[aria-pressed="true"] { color: var(--ink); border-bottom-color: var(--ink); }
  .tab:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  main { padding: 32px 32px 64px; }
  .intro { max-width: 760px; margin: 0 0 24px; }
  .intro h1 {
    font-family: var(--serif);
    font-size: 30px;
    line-height: 36px;
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0 0 8px;
  }
  .intro p { margin: 0; max-width: 68ch; color: var(--ink-soft); font-size: 13px; line-height: 20px; }
  .directions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: start; }
  .direction {
    min-width: 0;
    background: var(--dsw-alias-bg-layer-2);
    color: var(--dsw-alias-label-primary);
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
    outline: 2px solid transparent;
    outline-offset: 2px;
    scroll-margin-top: 84px;
    transition: opacity 160ms ease, outline-color 160ms ease;
  }
  body.has-focus .direction:not(.is-focused) { opacity: 0.5; }
  .direction.is-focused { outline-color: var(--dsw-alias-state-business-primary); }
  .direction-head {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-bottom: 1px solid var(--dsw-alias-border-l2);
  }
  .direction-name-row { display: flex; align-items: baseline; gap: 8px; }
  .direction-index {
    font-family: var(--mono);
    font-size: 12px;
    line-height: 16px;
    color: var(--dsw-alias-label-tertiary);
    font-variant-numeric: tabular-nums;
  }
  .direction-name {
    margin: 0;
    font-family: var(--serif);
    font-size: 24px;
    line-height: 30px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .direction-rationale {
    margin: 0;
    max-width: 46ch;
    font-size: 12px;
    line-height: 18px;
    color: var(--dsw-alias-label-secondary);
  }
  .theme-switch {
    display: inline-flex;
    align-self: flex-start;
    gap: 2px;
    padding: 2px;
    background: var(--dsw-alias-bg-layer-1);
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 6px;
  }
  .theme-btn {
    appearance: none;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--dsw-alias-label-tertiary);
    font: inherit;
    font-size: 12px;
    line-height: 16px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .theme-btn:hover { color: var(--dsw-alias-label-primary); }
  .theme-btn[aria-pressed="true"] {
    background: var(--dsw-alias-bg-layer-2);
    color: var(--dsw-alias-label-primary);
    box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l3);
  }
  .theme-btn:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
  .direction-preview {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
    font-size: 13px;
    line-height: 20px;
  }
  .surface-block { min-width: 0; }
  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .block-title {
    margin: 0;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dsw-alias-label-secondary);
  }
  .block-slot {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 16px;
    color: var(--dsw-alias-label-tertiary);
  }
  .surface-frame {
    min-width: 0;
    background: var(--dsw-alias-bg-layer-2);
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 10px;
    overflow: hidden;
    font-size: 13px;
    line-height: 20px;
  }
  .surface-frame.is-tall { overflow: hidden; }
  .direction :focus-visible {
    outline: 2px solid var(--dsw-focus-ring-color);
    outline-offset: 2px;
  }
  .direction [data-ui-role="action"]:disabled,
  .direction [data-ui-role="action-primary"]:disabled,
  .direction [data-ui-role="switch"]:disabled {
    opacity: 0.5;
    cursor: not-allowed !important;
  }
  @media (max-width: 1080px) {
    main { padding: 24px; }
    .directions { grid-template-columns: 1fr; gap: 32px; }
    .direction-preview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .masthead { padding: 12px 16px; }
    main { padding: 16px; }
    .intro h1 { font-size: 24px; line-height: 30px; }
    .direction-preview { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    .direction { transition: none; }
  }
`

const directionCss = DIRECTIONS.map((direction) => `
  /* ${direction.name} */
  ${direction.css}
`).join('\n')

const pageScript = `
  (() => {
    const tabs = [...document.querySelectorAll('.tab')]
    const columns = [...document.querySelectorAll('.direction')]
    const focus = (target) => {
      const already = target !== null && target.classList.contains('is-focused')
      columns.forEach((column) => column.classList.remove('is-focused'))
      document.body.classList.toggle('has-focus', target !== null && !already)
      tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(target !== null && !already && tab.dataset.target === target.id)))
      if (target !== null && !already) {
        target.classList.add('is-focused')
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        focus(document.getElementById(tab.dataset.target))
      })
    })
    document.querySelectorAll('.theme-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const column = button.closest('.direction')
        const theme = button.dataset.theme
        column.dataset.theme = theme
        column.querySelectorAll('.theme-btn').forEach((other) => {
          other.setAttribute('aria-pressed', String(other.dataset.theme === theme))
        })
      })
    })
  })()
`

const css = [
  pageCss,
  '/* Host token stand-ins. The shipped plugin reads the real DSH values. */',
  tokenBlock('host', 'light'),
  tokenBlock('host', 'dark'),
  '.direction { --dsw-radius-sm: 6px; --dsw-radius-xl: 10px; }',
  '/* Astryx neutral palette, read from @astryxdesign/theme-neutral@0.7.13. Literal values live in this preview only. */',
  tokenBlock('astryx', 'light'),
  tokenBlock('astryx', 'dark'),
  ...collectedStyles,
  directionCss,
].join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Study Plus — UI directions</title>
<style>${css}</style>
</head>
<body>
<header class="masthead">
  <div class="brand">
    <span class="brand-mark">Study Plus</span>
    <span class="brand-kicker">UI directions</span>
  </div>
  <nav class="tabs" aria-label="Direction focus">
    ${DIRECTIONS.map((direction) => `<button class="tab" type="button" data-target="dir-${direction.id}" aria-pressed="false">${escapeText(direction.name)}</button>`).join('\n    ')}
  </nav>
</header>
<main>
  <div class="intro">
    <h1>Three directions for the study surfaces</h1>
    <p>Rendered from the shipped components in client.js: settings, the Study view, the Lectures pane, and the Study Sessions page. Colors come from host tokens. Astryx is a local palette comparison and never ships. Each column has its own light and dark toggle.</p>
  </div>
  <div class="directions">${DIRECTIONS.map(directionFor).join('')}
  </div>
</main>
<script>${pageScript}</script>
</body>
</html>
`

await writeFile(new URL('./preview.html', import.meta.url), html, 'utf8')
console.log(`wrote ${fileURLToPath(new URL('./preview.html', import.meta.url))} (${(html.length / 1024).toFixed(1)} KB)`)

// README screenshots: one surface per page, the Shipped direction, host light
// palette on :root so html and body can read the same tokens.
if (process.env.PREVIEW_SHOTS === '1') {
  const SHOTS = { study: 380, lectures: 380, sessions: 720 }
  const rootTokens = Object.entries(PALETTES.host.light).map(([name, value]) => `${name}:${value}`).join(';')
  for (const [key, width] of Object.entries(SHOTS)) {
    const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${key}</title>
<style>${css}
:root { ${rootTokens}; color-scheme: light; }
html, body { margin: 0; background: var(--dsw-alias-bg-layer-2); }
.direction.shot { width: ${width}px; border: 0; border-radius: 0; box-shadow: none; outline: 0; overflow: visible; }
</style>
</head>
<body><div class="direction shot" data-direction="shipped" data-palette="host" data-theme="light">${markup.shipped[key]}</div></body>
</html>`
    await writeFile(new URL(`./shot-${key}.html`, import.meta.url), page, 'utf8')
  }
  console.log('wrote shot-study.html, shot-lectures.html, shot-sessions.html')
}
