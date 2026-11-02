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
  'assets/section.md',
  'GLOSSARY.md',
]

// The two copies of the calibration rules, restated for plain Nerd Mode.
const POLICY_COPIES = ['skills/study-plus/SKILL.md', 'assets/section.md']

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

test('the opening question comes before the path choice', () => {
  const section = read('assets/section.md')
  assert.match(section, /opening question/i)
  assert.match(section, /bare topic/i)
  assert.match(read('skills/study/SKILL.md'), /bare topic/i)
  assert.match(read('skills/study-plus/SKILL.md'), /opening question/i)
})

// The opening question is a fixed set of single choices, listed in one copy of
// the prompt. A label lost from that copy fails here.
const OPENING_CHOICES = [
  /single-choice/i,
  /pass an exam/i,
  /understand the principles/i,
  /use it in a project or at work/i,
  /get a rough overview/i,
  /never studied it/i,
  /read introductory material/i,
  /took a course or systematic training/i,
  /used it at work/i,
  /one complete answer in this conversation/i,
  /no Course record/i,
  /current Course/i,
  /each existing Course/i,
  /one concept per session/i,
  /start a new Course/i,
  /numbered text list/i,
]

test('the opening question keeps every fixed choice', () => {
  const section = read('assets/section.md')
  for (const choice of OPENING_CHOICES) {
    assert.match(section, choice, `assets/section.md lost ${choice}`)
  }
  assert.match(read('skills/study-plus/SKILL.md'), /start a new Course/i)
  assert.match(read('skills/study/SKILL.md'), /brief from an upper layer is final/i)
})

test('the graph approval keeps the table out of the question text', () => {
  const skill = read('skills/study-plus/SKILL.md')
  assert.match(skill, /full graph and chapter layout in the reply before the approval question/i)
  assert.match(skill, /Do not put the table in the question text/i)
})

test('a new Course asks for its name and handles a name collision', () => {
  const skill = read('skills/study-plus/SKILL.md')
  assert.match(skill, /asks for its name once/i)
  assert.match(skill, /matches an existing Course/i)
  assert.match(skill, /continue that Course or use another name/i)
})

test('the path item lists only Courses that exist', () => {
  for (const path of ['assets/section.md', 'skills/study-plus/SKILL.md']) {
    assert.match(read(path), /only for a Course that exists under `study\/`/i, `${path} lost the existing-Course rule`)
  }
})

test('the graph format line names the three levels in order', () => {
  assert.match(read('skills/study-plus/SKILL.md'), /^Teaching level: beginner \| standard \| advanced$/m)
})

// A multiple-choice slot is one question card. A rule deleted from the skill
// fails here.
const QUESTION_CARD = [
  /One call asks one question/,
  /one `question` call with four options/,
  /no description/,
  /shuffle the four positions/,
  /numbered text list/,
  /names or repeats one option/,
  /closes the question card/,
]

test('a multiple-choice question is one question card', () => {
  const skill = read('skills/study-plus/SKILL.md')
  for (const pattern of QUESTION_CARD) {
    assert.match(skill, pattern, `skills/study-plus/SKILL.md lost ${pattern}`)
  }
  assert.match(skill, /`short-answer`, ask the question in the conversation/)
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
