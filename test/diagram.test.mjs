import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkSvg } from '../skills/diagram/scripts/check-svg.mjs'

const LIGHT = `<style>
  .panel { } .title { } .label { } .sub { } .note { } .wire { } .head { }
  .b1 { } .b2 { } .b3 { } .b4 { }
</style>`

const PALETTE = `<style>
  .panel { } .title { } .label { } .sub { } .note { } .wire { } .head { }
  .b1 { } .b2 { } .b3 { } .b4 { }
  @media (prefers-color-scheme: dark) { .panel { } }
</style>`

const NODE = `<rect class="b1" x="28" y="76" width="180" height="60" rx="8"/>
<text class="label" x="118" y="111" text-anchor="middle">Start</text>`

function svg({ body = NODE, aria = 'A to B', extra = '', style = PALETTE } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="${aria}"${extra}>
  ${style}
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0 0 L10 5 L0 10 z"/></marker></defs>
  <rect class="panel" x="0.75" y="0.75" width="718.5" height="198.5" rx="12"/>
  <text class="title" x="28" y="40" font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="15">A to B</text>
  <g font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="13">
    ${body}
  </g>
</svg>`
}

const fails = (findings) => findings.filter((finding) => finding.level === 'FAIL')
const warns = (findings) => findings.filter((finding) => finding.level === 'WARN')

test('a clean figure reports nothing', () => {
  const { findings } = checkSvg(svg())
  assert.deepEqual(findings, [])
})

test('an empty aria-label fails', () => {
  const { findings } = checkSvg(svg({ aria: '' }))
  assert.ok(fails(findings).some((finding) => finding.area === 'root' && /aria-label/.test(finding.message)))
})

test('a raw hex fill fails', () => {
  const body = `${NODE}<rect class="b1" x="270" y="76" width="180" height="60" rx="8" fill="#ffffff"/>`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(fails(findings).some((finding) => finding.area === 'color'))
})

test('a named color fails', () => {
  const body = `<rect class="b1" x="28" y="76" width="180" height="60" rx="8" fill="white"/>`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(fails(findings).some((finding) => finding.area === 'color'))
})

test('a label wider than its box fails', () => {
  const body = `<rect class="b1" x="28" y="76" width="180" height="60" rx="8"/>
<text class="label" x="118" y="111" text-anchor="middle">next-token distribution</text>`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(fails(findings).some((finding) => finding.area === 'text' && /next-token distribution/.test(finding.message)))
})

test('a CJK label wider than its box fails', () => {
  const body = `<rect class="b1" x="28" y="76" width="180" height="60" rx="8"/>
<text class="label" x="118" y="111" text-anchor="middle">这是一个非常长的中文标签</text>`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(fails(findings).some((finding) => finding.area === 'text'))
})

test('an arrow without a marker definition fails', () => {
  const body = `${NODE}<line x1="208" y1="106" x2="262" y2="106" marker-end="url(#missing)" stroke-width="1.5"/>`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(fails(findings).some((finding) => finding.area === 'marker' && /missing/.test(finding.message)))
})

test('more than twelve nodes warns without failing', () => {
  const body = Array.from({ length: 13 }, (_, index) => {
    const x = 28 + (index % 3) * 180
    const y = 76 + Math.floor(index / 3) * 30
    return `<rect class="b1" x="${x}" y="${y}" width="160" height="20" rx="8"/>`
  }).join('\n')
  const { findings } = checkSvg(svg({ body }))
  assert.ok(warns(findings).some((finding) => finding.area === 'nodes'))
  assert.equal(fails(findings).length, 0)
})

test('a text outside a font group warns', () => {
  const body = `${NODE}</g><text class="note" x="28" y="180">note</text><g font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="13">`
  const { findings } = checkSvg(svg({ body }))
  assert.ok(warns(findings).some((finding) => finding.area === 'font'))
})

test('a missing dark-mode block fails', () => {
  const { findings } = checkSvg(svg({ style: LIGHT }))
  assert.ok(fails(findings).some((finding) => finding.area === 'style' && /dark-mode/.test(finding.message)))
})

// The starter in SKILL.md must pass its own floor.
test('the starter passes the checker', () => {
  const skill = readFileSync(new URL('../skills/diagram/SKILL.md', import.meta.url), 'utf8')
  const blocks = [...skill.matchAll(/```svg\n([\s\S]*?)```/g)].map((match) => match[1])
  const palette = blocks.find((block) => block.startsWith('<style>'))
  const starter = blocks.find((block) => block.startsWith('<svg'))
  const { findings } = checkSvg(starter.replace('<style>…the palette above…</style>', palette))
  assert.deepEqual(fails(findings), [])
})
