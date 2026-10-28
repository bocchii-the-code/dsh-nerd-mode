import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBookData } from '../skills/study-plus/scripts/book-data.mjs'

const builder = fileURLToPath(new URL('../skills/study-plus/scripts/build-book.mjs', import.meta.url))

const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n')

const lecture = (concept, title = `Concept ${concept}`) => ({
  name: `${String(concept).padStart(2, '0')}-${title.toLowerCase().replaceAll(' ', '-')}.md`,
  text: `---\ndate: 2026-10-28\nconcept: ${concept}\n---\n\n# ${title}\n\nLecture body for ${title}.`,
})

const draft = (concept, title = `Concept ${concept}`) => ({
  name: `${String(concept).padStart(2, '0')}-${title.toLowerCase().replaceAll(' ', '-')}.md`,
  text: `---\nstatus: draft\nconcept: ${concept}\n---\n\n# ${title}\n\nLecture body for ${title}.`,
})

const payloadOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="bk-book">([\s\S]*?)<\/script>/)[1])

const makeTopic = (workspace, graph, files) => {
  const topic = join(workspace, 'study', 'topic')
  const lectures = join(topic, 'lectures')
  mkdirSync(lectures, { recursive: true })
  writeFileSync(join(topic, 'graph.md'), graph)
  for (const file of files) writeFileSync(join(lectures, file.name), file.text)
  return { topic, lectures }
}

const oneConceptGraph = [
  '# Topic: Ratios',
  'Book: Ratios',
  table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Ratio', 'A comparison', '-']]),
].join('\n')

test('orders multi-chapter sections by chapter and section, with existing counts', () => {
  const graph = [
    '# Topic: Calculus',
    'Goal: Understand derivatives',
    'Book: A Short Calculus',
    '',
    '## Chapters',
    '1. Rates: Local change',
    '2. Rules: Derivative operations',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Chapter', 'Section'], [
      ['1', 'Rate', 'Change per unit', '-', '1', '2'],
      ['2', 'Limit', 'Nearby value', '-', '1', '1'],
      ['3', 'Sum rule', 'Derivative of a sum', '1', '2', '1'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1, 'Rate'), lecture(3, 'Sum rule')])

  assert.equal(book.title, 'A Short Calculus')
  assert.equal(book.goal, 'Understand derivatives')
  assert.deepEqual(book.chapters.map(({ n, name, count }) => ({ n, name, count })), [
    { n: 1, name: 'Rates', count: 1 },
    { n: 2, name: 'Rules', count: 1 },
  ])
  assert.deepEqual(book.units.map(({ concept, chapter, section, index }) => ({ concept, chapter, section, index })), [
    { concept: 1, chapter: 1, section: 2, index: 0 },
    { concept: 3, chapter: 2, section: 1, index: 1 },
  ])
})

test('maps legacy Structure and Block rows in graph order', () => {
  const graph = [
    '# Topic: Networks',
    '## Structure',
    '1. Foundations: Basic terms',
    '2. Routing: Path selection',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Block'], [
      ['1', 'Node', 'A point', '-', '1'],
      ['2', 'Edge', 'A connection', '1', '1'],
      ['3', 'Route', 'A path', '2', '2'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1), lecture(3)])

  assert.deepEqual(book.chapters.map(({ n, count }) => ({ n, count })), [{ n: 1, count: 1 }, { n: 2, count: 1 }])
  assert.deepEqual(book.units.map(({ concept, chapter, section }) => ({ concept, chapter, section })), [
    { concept: 1, chapter: 1, section: 1 },
    { concept: 3, chapter: 2, section: 1 },
  ])
})

test('rejects legacy Structure entries with missing chapter scope', () => {
  const graph = [
    '# Topic: Networks',
    '## Structure',
    '1. Foundations',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Block'], [
      ['1', 'Node', 'A point', '-', '1'],
    ]),
  ].join('\n')

  assert.throws(
    () => parseBookData(graph, [lecture(1)]),
    /## Structure entry "1\. Foundations" is incomplete\. Use "N\. <title>: <scope>"\./,
  )
})

test('uses a default chapter and graph-row section order without grouping metadata', () => {
  const graph = [
    '# Topic: Probability',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [
      ['1', 'Sample space', 'Possible outcomes', '-'],
      ['2', 'Event', 'A set of outcomes', '1'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1, 'Sample space'), lecture(2, 'Event')])

  assert.deepEqual(book.chapters, [{ n: 1, name: 'Probability', description: '', count: 2 }])
  assert.deepEqual(book.units.map(({ concept, section }) => [concept, section]), [[1, 1], [2, 2]])
})

test('uses graph concept names for rendered section titles', () => {
  const graph = [
    '# Topic: Physics',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [
      ['1', 'Wave interference', 'Overlapping waves combine', '-'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1, 'A Different Lecture Heading')])

  assert.equal(book.units[0].title, 'Wave interference')
  assert.equal(book.units[0].sourceTitle, 'A Different Lecture Heading')
})

test('skips missing lectures, preserves planned section ordinals, and omits empty chapters', () => {
  const graph = [
    '# Topic: Biology',
    '## Chapters',
    '1. Cells: Basic structures',
    '2. Tissues: Cell groups',
    '3. Organs: Body systems',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Chapter', 'Section'], [
      ['1', 'Membrane', 'A cell boundary', '-', '1', '1'],
      ['2', 'Cytoplasm', 'Cell interior', '1', '1', '2'],
      ['3', 'Nucleus', 'Cell control', '1', '1', '3'],
      ['4', 'Ribosome', 'Protein builder', '3', '1', '4'],
      ['5', 'Cell wall', 'Outer support', '1', '1', '5'],
      ['6', 'Tissue', 'Cell group', '2', '2', '1'],
      ['7', 'Organ', 'Body structure', '6', '3', '1'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1, 'Membrane'), lecture(3, 'Nucleus'), lecture(4, 'Ribosome'), lecture(6, 'Tissue')])

  assert.deepEqual(book.chapters.map(({ n, count }) => ({ n, count })), [{ n: 1, count: 3 }, { n: 2, count: 1 }])
  assert.deepEqual(book.units.map(({ concept, chapter, section }) => [concept, chapter, section]), [
    [1, 1, 1], [3, 1, 3], [4, 1, 4], [6, 2, 1],
  ])
  assert.equal(book.chapters[0].count, 3)
})

test('reports lecture files whose concept number is absent from the graph', () => {
  const graph = [
    '# Topic: Logic',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Proposition', 'A claim', '-']]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1), lecture(9)])

  assert.deepEqual(book.orphans, ['09-concept-9.md'])
  assert.deepEqual(book.units.map(({ concept }) => concept), [1])
})

test('rejects duplicate lecture mappings and malformed or duplicate frontmatter', () => {
  const graph = [
    '# Topic: Logic',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Proposition', 'A claim', '-']]),
  ].join('\n')
  assert.throws(() => parseBookData(graph, [lecture(1), { ...lecture(1), name: 'duplicate.md' }]), /already mapped/)
  assert.throws(() => parseBookData(graph, [{ ...lecture(1), text: lecture(1).text.replace('date: 2026-10-28', 'date: 2026-10-28\nconcept: 2') }]), /duplicate frontmatter field/)
  assert.throws(() => parseBookData(graph, [{ name: 'broken.md', text: '# no metadata' }]), /malformed frontmatter/)
})

test('rejects invalid, duplicate, unknown, and nonconsecutive chapter or section mappings', () => {
  const graphFor = (rows) => [
    '# Topic: Algebra',
    '## Chapters',
    '1. Basics: Core ideas',
    '2. Uses: Applications',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Chapter', 'Section'], rows),
  ].join('\n')
  const validOne = ['1', 'A', 'A concept', '-', '1', '1']

  assert.throws(() => parseBookData(graphFor([['1', 'A', 'A concept', '-', '1', '0']]), [lecture(1)]), /Section 0/)
  assert.throws(() => parseBookData(graphFor([['1', 'A', 'A concept', '-', '3', '1']]), [lecture(1)]), /not listed under ## Chapters/)
  assert.throws(() => parseBookData(graphFor([validOne, ['2', 'B', 'Another', '1', '1', '1']]), [lecture(1)]), /both use Chapter 1, Section 1/)
  assert.throws(() => parseBookData(graphFor([validOne, ['2', 'B', 'Another', '1', '1', '3']]), [lecture(1)]), /nonconsecutive Section numbering/)
  assert.throws(() => parseBookData(graphFor([['2', 'A', 'A concept', '-', '1', '1']]), [lecture(2)]), /concept numbers must be consecutive/)
})

test('fails clearly when no lecture files exist', () => {
  const graph = [
    '# Topic: Geometry',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Point', 'A location', '-']]),
  ].join('\n')
  assert.throws(() => parseBookData(graph, []), /No lecture files found/)
})

test('CLI rejects topic paths outside workspace study and unsafe book outputs', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-book-'))
  try {
    const study = join(workspace, 'study')
    const topic = join(study, 'topic')
    const outside = join(workspace, 'outside')
    mkdirSync(study)
    mkdirSync(topic)
    mkdirSync(outside)

    const escaped = spawnSync(process.execPath, [builder, outside], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(escaped.status, 0)
    assert.match(escaped.stderr, /at least one level below workspace study/)

    const linkedTopic = join(study, 'linked-topic')
    try {
      symlinkSync(outside, linkedTopic, 'junction')
      const linked = spawnSync(process.execPath, [builder, linkedTopic], { cwd: workspace, encoding: 'utf8' })
      assert.notEqual(linked.status, 0)
      assert.match(linked.stderr, /at least one level below workspace study/)
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES' && error.code !== 'ENOTSUP') throw error
    }

    writeFileSync(join(topic, 'graph.md'), [
      '# Topic: Safe output',
      table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Point', 'A location', '-']]),
    ].join('\n'))
    const lectures = join(topic, 'lectures')
    mkdirSync(lectures)
    writeFileSync(join(lectures, '01-point.md'), lecture(1, 'Point').text)
    const output = join(topic, 'book.html')
    const target = join(workspace, 'kept.html')
    writeFileSync(target, 'preserve this file')
    try {
      symlinkSync(target, output, 'file')
    } catch {
      mkdirSync(output)
    }

    const unsafe = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(unsafe.status, 0)
    assert.match(unsafe.stderr, /Refusing to overwrite (symlink|non-regular) book output/)
    assert.equal(existsSync(target), true)
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('CLI rejects a symlink at the workspace study root', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-link-root-'))
  try {
    const outside = join(workspace, 'outside')
    const study = join(workspace, 'study')
    mkdirSync(outside)
    symlinkSync(outside, study, 'junction')

    const result = spawnSync(process.execPath, [builder, join(study, 'topic')], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Refusing to use symlink as workspace study/)
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('CLI renders quoted YAML metadata and overwrites a regular book output', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-render-'))
  try {
    const topic = join(workspace, 'study', 'topic')
    const lectures = join(topic, 'lectures')
    mkdirSync(lectures, { recursive: true })
    writeFileSync(join(topic, 'graph.md'), [
      '# Topic: Ratios',
      'Goal: Compare values: # "safely" \\',
      'Book: Ratios: # "quoted" \\ title',
      table(['#', 'Concept', 'Definition', 'Prerequisites'], [['1', 'Ratio', 'A comparison', '-']]),
    ].join('\n'))
    writeFileSync(join(lectures, '01-ratio.md'), lecture(1, 'Ratio').text)
    const output = join(topic, 'book.html')
    writeFileSync(output, 'old book page')

    const result = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const html = readFileSync(output, 'utf8')
    assert.notEqual(html, 'old book page')
    assert.match(html, /Content-Security-Policy/)
    const payloadText = html.match(/<script type="application\/json" id="bk-book">([\s\S]*?)<\/script>/)?.[1]
    assert.ok(payloadText)
    const payload = JSON.parse(payloadText)
    assert.equal(payload.title, 'Ratios: # "quoted" \\ title')
    assert.equal(payload.goal, 'Compare values: # "safely" \\')
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('parses draft and dated lecture status', () => {
  const graph = [
    '# Topic: Drafts',
    table(['#', 'Concept', 'Definition', 'Prerequisites'], [
      ['1', 'Ratio', 'A comparison', '-'],
      ['2', 'Rate', 'Change per unit', '1'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [lecture(1, 'Ratio'), draft(2, 'Rate')])

  assert.deepEqual(book.units.map(({ concept, status }) => ({ concept, status })), [
    { concept: 1, status: 'lecture' },
    { concept: 2, status: 'draft' },
  ])
})

test('keeps chapter and section order for mixed drafts and lectures', () => {
  const graph = [
    '# Topic: Mixed',
    '## Chapters',
    '1. Basics: Core ideas',
    '2. Uses: Applications',
    '',
    table(['#', 'Concept', 'Definition', 'Prerequisites', 'Chapter', 'Section'], [
      ['1', 'Ratio', 'A comparison', '-', '1', '2'],
      ['2', 'Rate', 'Change per unit', '1', '1', '1'],
      ['3', 'Scale', 'Size relation', '1', '2', '1'],
    ]),
  ].join('\n')
  const book = parseBookData(graph, [draft(1, 'Ratio'), lecture(2, 'Rate'), draft(3, 'Scale')])

  assert.deepEqual(book.chapters.map(({ n, count }) => ({ n, count })), [{ n: 1, count: 2 }, { n: 2, count: 1 }])
  assert.deepEqual(book.units.map(({ concept, chapter, section, status, index }) => ({ concept, chapter, section, status, index })), [
    { concept: 2, chapter: 1, section: 1, status: 'lecture', index: 0 },
    { concept: 1, chapter: 1, section: 2, status: 'draft', index: 1 },
    { concept: 3, chapter: 2, section: 1, status: 'draft', index: 2 },
  ])
})

test('rejects a draft with a teaching date and an unknown status value', () => {
  const graph = oneConceptGraph
  const dated = { ...draft(1), text: draft(1).text.replace('status: draft', 'status: draft\ndate: 2026-10-28') }
  assert.throws(() => parseBookData(graph, [dated]), /a draft has no teaching date/)
  const published = { ...lecture(1), text: lecture(1).text.replace('date: 2026-10-28', 'status: published') }
  assert.throws(() => parseBookData(graph, [published]), /frontmatter status must be "draft" or absent/)
})

test('CLI excludes lecture files under lectures/archive', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-archive-'))
  try {
    const graph = [
      '# Topic: Ratios',
      'Book: Ratios',
      table(['#', 'Concept', 'Definition', 'Prerequisites'], [
        ['1', 'Ratio', 'A comparison', '-'],
        ['2', 'Rate', 'Change per unit', '1'],
      ]),
    ].join('\n')
    const { topic, lectures } = makeTopic(workspace, graph, [lecture(1, 'Ratio'), draft(2, 'Rate')])
    mkdirSync(join(lectures, 'archive'), { recursive: true })
    writeFileSync(join(lectures, 'archive', '07-retired.md'), lecture(7, 'Retired').text)

    const result = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const payload = payloadOf(readFileSync(join(topic, 'book.html'), 'utf8'))
    assert.deepEqual(payload.units.map(({ concept, status }) => ({ concept, status })), [
      { concept: 1, status: 'lecture' },
      { concept: 2, status: 'draft' },
    ])
    assert.doesNotMatch(result.stderr, /Orphan/)
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('CLI backs up the previous book and replaces the older backup', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-backup-'))
  try {
    const { topic, lectures } = makeTopic(workspace, oneConceptGraph, [lecture(1, 'Ratio')])
    const output = join(topic, 'book.html')
    const backup = join(topic, 'book.html.bak')
    writeFileSync(output, 'old book page')

    const first = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr)
    assert.equal(readFileSync(backup, 'utf8'), 'old book page')
    const firstHtml = readFileSync(output, 'utf8')

    writeFileSync(join(lectures, '01-ratio.md'), lecture(1, 'Ratio').text.replace('Lecture body', 'Changed body'))
    const second = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.equal(second.status, 0, second.stderr)
    assert.equal(readFileSync(backup, 'utf8'), firstHtml)
    assert.notEqual(readFileSync(output, 'utf8'), firstHtml)
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('CLI failure leaves the book and backup intact and removes the temp file', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-failure-'))
  try {
    const { topic } = makeTopic(workspace, oneConceptGraph, [lecture(1, 'Ratio')])
    const output = join(topic, 'book.html')
    const backup = join(topic, 'book.html.bak')
    writeFileSync(output, 'old book page')

    const first = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr)
    const html = readFileSync(output, 'utf8')
    const backupText = readFileSync(backup, 'utf8')

    writeFileSync(join(topic, 'graph.md'), [
      '# Topic: Ratios',
      '## Chapters',
      '1. Basics: Core ideas',
      '',
      table(['#', 'Concept', 'Definition', 'Prerequisites', 'Chapter', 'Section'], [
        ['1', 'Ratio', 'A comparison', '-', '1', '1'],
        ['2', 'Rate', 'Change per unit', '1', '1', '1'],
      ]),
    ].join('\n'))
    const second = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(second.status, 0)
    assert.match(second.stderr, /both use Chapter 1, Section 1/)
    assert.equal(readFileSync(output, 'utf8'), html)
    assert.equal(readFileSync(backup, 'utf8'), backupText)
    assert.deepEqual(readdirSync(topic).filter((name) => name.startsWith('.book.new-')), [])
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

test('CLI refuses a non-regular book backup', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'study-plus-bak-guard-'))
  try {
    const { topic } = makeTopic(workspace, oneConceptGraph, [lecture(1, 'Ratio')])
    mkdirSync(join(topic, 'book.html.bak'))

    const result = spawnSync(process.execPath, [builder, topic], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Refusing to overwrite non-regular book backup/)
    assert.equal(existsSync(join(topic, 'book.html')), false)
  } finally {
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
