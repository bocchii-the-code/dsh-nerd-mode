import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

const LEVELS = ['beginner', 'standard', 'advanced']

// Every file that states the teaching-level policy must name every level.
const POLICY_FILES = [
  'skills/study/SKILL.md',
  'skills/study-plus/SKILL.md',
  'cordis.patch.yml',
  'GLOSSARY.md',
]

// The two copies of the calibration rules, restated for plain Nerd Mode.
const POLICY_COPIES = ['skills/study-plus/SKILL.md', 'cordis.patch.yml']

// One anchor per mapping row. Both copies must keep every row.
const MAPPING = [
  ['beginner', /most prerequisites are unknown/i, /learn the topic from zero/i],
  ['standard', /some prerequisites are known/i, /principles or pass an exam/i],
  ['advanced', /most prerequisites are known/i, /review, reference, or use in a project/i],
]

// One anchor per calibration rule. A rule deleted from one copy fails here.
const RULES = [
  ['the adjacent-level escape', /adjacent level/i],
  ['the decline path', /declines or gives no usable answer/i],
  ['the standard fallback', /Teaching level: standard/i],
  ['the missing-line default', /missing `?Teaching level`? line means `?standard`?/i],
  ['the existing-topic rule', /already has a `?graph\.md`?/i],
  ['the verbatim handoff', /verbatim/i],
]

test('every file that states the policy names all three levels', () => {
  for (const path of POLICY_FILES) {
    const text = read(path)
    for (const level of LEVELS) {
      assert.match(text, new RegExp(`\\b${level}\\b`), `${path} lost the ${level} level`)
    }
  }
})

test('both copies keep every row of the level table', () => {
  for (const path of POLICY_COPIES) {
    const text = read(path)
    for (const [level, ...patterns] of MAPPING) {
      for (const pattern of patterns) {
        assert.match(text, pattern, `${path} lost the ${level} row (${pattern})`)
      }
    }
  }
})

test('both copies keep every calibration rule', () => {
  for (const path of POLICY_COPIES) {
    const text = read(path)
    for (const [rule, pattern] of RULES) {
      assert.match(text, pattern, `${path} lost ${rule} (${pattern})`)
    }
  }
})

test('the graph format line names the three levels in order', () => {
  assert.match(read('skills/study-plus/SKILL.md'), /^Teaching level: beginner \| standard \| advanced$/m)
})

test('every README image is a real SVG with a title and a viewBox', () => {
  for (const path of ['README.md', 'README.zh.md']) {
    const text = read(path)
    const sources = [...text.matchAll(/src="(assets\/[^"]+\.svg)"/g)].map((match) => match[1])
    assert.ok(sources.length >= 3, `${path} references ${sources.length} images`)
    for (const source of new Set(sources)) {
      const file = fileURLToPath(new URL(`../${source}`, import.meta.url))
      assert.ok(existsSync(file), `${path} points at a missing ${source}`)
      const svg = readFileSync(file, 'utf8')
      assert.match(svg, /<svg[^>]*viewBox="[^"]+"/, `${source} has no viewBox`)
      assert.match(svg, /<title[^>]*>\s*\S/, `${source} has no title`)
    }
  }
})
