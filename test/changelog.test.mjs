import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')
const changelog = root('CHANGELOG.md')

// A version heading is `## [0.4.0] - 2026-10-31`, optionally with a status suffix.
const HEADING = /^## \[(\d+)\.(\d+)\.(\d+)\](.*)$/

const sections = changelog
  .split(/^## /m)
  .slice(1)
  .map((block) => {
    const [heading, ...body] = block.split('\n')
    const parsed = HEADING.exec(`## ${heading}`)
    if (!parsed) throw new Error(`unparseable changelog heading: ${heading}`)
    return { heading: `## ${heading}`, version: parsed.slice(1, 4).join('.'), body: body.join('\n') }
  })

test('the newest changelog entry names the package version', () => {
  const { version } = JSON.parse(root('package.json'))
  assert.equal(sections[0].version, version)
})

test('changelog entries run from newest to oldest', () => {
  const numbers = sections.map(({ version }) => version.split('.').map(Number))
  for (let i = 1; i < numbers.length; i += 1) {
    const newer = numbers[i - 1]
    const older = numbers[i]
    const descending =
      newer[0] > older[0] ||
      (newer[0] === older[0] && newer[1] > older[1]) ||
      (newer[0] === older[0] && newer[1] === older[1] && newer[2] > older[2])
    assert.ok(descending, `${sections[i - 1].version} must be newer than ${sections[i].version}`)
  }
})

test('every changelog entry has a date and a change group', () => {
  for (const { heading, body } of sections) {
    assert.match(heading, / - \d{4}-\d{2}-\d{2}( \(unpublished\))?$/)
    assert.match(body, /^### (Added|Changed|Fixed)$/m)
  }
})

test('only the version tagged but never published is marked unpublished', () => {
  assert.doesNotMatch(changelog, /Unreleased/)
  const marked = sections.filter(({ heading }) => heading.includes('(unpublished)'))
  assert.deepEqual(marked.map(({ version }) => version), ['0.3.0'])
})
