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

// Each goal and background option carries a fixed depth description. A lost
// description lets the model invent a claim the level table does not support.
const OPENING_DESCRIPTIONS = [
  /偏全：按考点讲全，不逐句铺开/,
  /偏推导：讲清概念之间的关系/,
  /偏快：一段讲完，例子从简/,
  /偏慢：分步讲，术语逐个解释/,
  /偏慢：术语首次出现就解释/,
  /标准：基础名词不再逐个解释/,
  /偏快：重复内容略过/,
  /偏快：跳过直觉，从定义起讲/,
  /Path options carry no description/,
]

test('the opening question keeps every depth description', () => {
  const section = read('assets/section.md')
  for (const description of OPENING_DESCRIPTIONS) {
    assert.match(section, description, `assets/section.md lost ${description}`)
  }
})


test('the graph approval keeps the table out of the question text', () => {
  const skill = read('skills/study-plus/SKILL.md')
  assert.match(skill, /full graph and chapter layout in the reply before the approval question/i)
  assert.match(skill, /Do not put the table in the question text/i)
})

// Four lecture rules: a concrete opening, an adjacent figure, a chapter map, and no decorative text.
const LECTURE_RULES = [
  /Start from one concrete instance/,
  /Put the figure next to the paragraph it explains/,
  /When no honest figure exists/,
  /open each chapter with one figure/,
  /Delete asides, restatements, and footnotes/,
  /Skip the intuition and the concrete opening/,
]

test('the lecture standard keeps the visual and concrete rules', () => {
  const skill = read('skills/study/SKILL.md')
  for (const pattern of LECTURE_RULES) {
    assert.match(skill, pattern, `skills/study/SKILL.md lost ${pattern}`)
  }
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
  /one question-tool call with four options/,
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

// The host tool is `ask_user_question`. A literal `question` reads as a tool
// that does not exist, which lets the model fall back to a text list.
test('the question card names no tool the host does not have', () => {
  assert.doesNotMatch(read('skills/study-plus/SKILL.md'), /`question`/)
})

// The skill catalog shows only the description. A stale copy stays visible
// only when the version travels with the text.
const VERSIONED_SKILLS = ['study', 'study-plus']

test('the study skills carry the package version', () => {
  const version = JSON.parse(read('package.json')).version
  for (const name of VERSIONED_SKILLS) {
    const frontmatter = read(`skills/${name}/SKILL.md`).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
    const raw = frontmatter.match(/^description:\s*(.*)$/m)?.[1]?.trim() ?? ''
    const description = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
    assert.ok(description.startsWith(`[v${version}] `), `skills/${name}/SKILL.md lost [v${version}]`)
  }
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
