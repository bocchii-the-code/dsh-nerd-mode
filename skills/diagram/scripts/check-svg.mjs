// Lint a diagram SVG against the floor in SKILL.md. No dependencies.
// The checker sees text, not pixels: it estimates label width and catches
// contract breaks. A rendered look still decides the final figure.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/
const PALETTE = ['.panel', '.title', '.label', '.sub', '.note', '.wire', '.head', '.b1', '.b2', '.b3', '.b4']

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`\\s${name}="([^"]*)"`))
  return match ? match[1] : null
}

function visibleText(raw) {
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function textWidth(text, size = 13) {
  const latin = size * 0.554
  let width = 0
  for (const char of text) width += CJK.test(char) ? size : latin
  return width
}

/**
 * Check one SVG source against the diagram floor.
 *
 * Args:
 *   source: the SVG file as text. It may be malformed; the checker reports that
 *     as a finding instead of throwing.
 *
 * Returns:
 *   { findings: Array<{ level: 'FAIL' | 'WARN', area: string, message: string }> }
 *
 * FAIL means the file breaks the contract. WARN means a style rule needs a
 * human decision. The caller sets the exit code.
 */
export function checkSvg(source) {
  const findings = []
  const fail = (area, message) => findings.push({ level: 'FAIL', area, message })
  const warn = (area, message) => findings.push({ level: 'WARN', area, message })

  const svg = source.match(/<svg\b([^>]*)>/)
  if (!svg) {
    fail('root', 'no <svg> element')
    return { findings }
  }

  const root = svg[1]
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(root)) fail('root', 'missing xmlns')
  const viewBox = attr(root, 'viewBox')
  const box = viewBox ? viewBox.trim().split(/[\s,]+/).map(Number) : []
  if (box.length !== 4 || box.some(Number.isNaN)) {
    fail('root', 'viewBox must hold four numbers')
  } else if (box[2] !== 720) {
    warn('root', `canvas is ${box[2]} wide; the budget is 720`)
  }
  const width = attr(root, 'width')
  const height = attr(root, 'height')
  if (!width || !height) {
    fail('root', 'missing width or height')
  } else if (box.length === 4 && (Number(width) !== box[2] || Number(height) !== box[3])) {
    warn('root', 'width and height do not match the viewBox')
  }
  if (attr(root, 'role') !== 'img') fail('root', 'missing role="img"')
  if (!attr(root, 'aria-label')) fail('root', 'missing or empty aria-label')

  const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
  if (!style) fail('style', 'missing <style> block')
  const styleCount = (source.match(/<style\b/g) ?? []).length
  if (styleCount > 1) fail('style', `${styleCount} <style> blocks; the floor allows one`)
  const missing = PALETTE.filter((name) => !style.includes(name))
  if (missing.length) fail('style', `missing palette classes: ${missing.join(', ')}`)
  if (!/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/.test(style)) {
    fail('style', 'missing dark-mode block')
  }

  for (const [label, pattern] of [
    ['script', /<script\b/i],
    ['foreignObject', /<foreignObject\b/i],
    ['external href', /\bhref="/],
    ['@import', /@import\b/],
    ['animation', /<animate\b|<set\b/i],
  ]) {
    if (pattern.test(source)) fail('forbidden', `${label} is not allowed`)
  }
  if (/url\((?!\s*#)/.test(source)) fail('forbidden', 'external url(...) is not allowed')
  if (/\\\(|\\\[|\$\$/.test(source)) fail('forbidden', 'LaTeX delimiter; use plain Unicode text')

  const outside = source.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  for (const match of outside.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)) {
    const value = match[1]
    if (value === 'none' || value === 'currentColor') continue
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) fail('color', `raw hex outside <style>: ${value}`)
    else fail('color', `paint "${value}" bypasses the palette classes`)
  }
  for (const match of outside.matchAll(/\bstyle="([^"]*)"/g)) {
    if (/#[0-9a-fA-F]{3,8}|(?:fill|stroke|color)\s*:/.test(match[1])) {
      fail('color', 'inline style carries paint; use the palette classes')
    }
  }

  const elements = []
  for (const match of source.matchAll(/<rect\b([^>]*?)\/?>/g)) {
    elements.push({ type: 'rect', index: match.index, attrs: match[1] })
  }
  for (const match of source.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    elements.push({ type: 'text', index: match.index, attrs: match[1], content: visibleText(match[2]) })
  }
  elements.sort((a, b) => a.index - b.index)

  const rects = elements.filter((element) => element.type === 'rect')
  const nodes = rects.filter((element) => !/\bpanel\b/.test(attr(element.attrs, 'class') ?? ''))
  if (nodes.length > 12) warn('nodes', `${nodes.length} nodes; the budget is 12`)

  for (const [index, element] of elements.entries()) {
    if (element.type !== 'text' || !element.content) continue
    const cls = attr(element.attrs, 'class') ?? ''
    const size = Number(attr(element.attrs, 'font-size')) || (cls.includes('title') ? 15 : cls.includes('note') ? 12 : 13)
    const needed = textWidth(element.content, size)
    const x = Number(attr(element.attrs, 'x'))
    const y = Number(attr(element.attrs, 'y'))
    let available = 664
    if (attr(element.attrs, 'text-anchor') === 'middle' && Number.isFinite(x) && Number.isFinite(y)) {
      for (let i = index - 1; i >= 0; i -= 1) {
        const rect = elements[i]
        if (rect.type !== 'rect') continue
        const rx = Number(attr(rect.attrs, 'x'))
        const ry = Number(attr(rect.attrs, 'y'))
        const rw = Number(attr(rect.attrs, 'width'))
        const rh = Number(attr(rect.attrs, 'height'))
        if ([rx, ry, rw, rh].every(Number.isFinite) && x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          available = rw - 36
          break
        }
      }
    }
    if (needed > available) {
      fail('text', `"${element.content}" needs ${Math.ceil(needed)}px, box has ${Math.floor(available)}px`)
    }
  }

  const stack = []
  for (const match of source.matchAll(/<(\/?)(g|text)\b([^>]*)>/g)) {
    const closing = match[1] === '/'
    const tag = match[2]
    const attrs = match[3]
    if (tag === 'g') {
      if (closing) stack.pop()
      else stack.push(attr(attrs, 'font-family') ?? stack.at(-1) ?? null)
      continue
    }
    if (!closing && !attr(attrs, 'font-family') && !stack.at(-1)) {
      warn('font', 'a <text> element has no font-family')
    }
  }

  const markers = [...source.matchAll(/marker-(?:start|mid|end)="url\(#([^)]+)\)"/g)].map((match) => match[1])
  for (const id of new Set(markers)) {
    if (!new RegExp(`<marker\\b[^>]*\\bid="${id}"`).test(source)) {
      fail('marker', `missing <marker id="${id}">`)
    }
  }

  return { findings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node check-svg.mjs <file.svg>')
    process.exit(2)
  }
  const { findings } = checkSvg(readFileSync(file, 'utf8'))
  for (const finding of findings) {
    console.log(`${finding.level}  ${finding.area}: ${finding.message}`)
  }
  const fails = findings.filter((finding) => finding.level === 'FAIL').length
  const warns = findings.length - fails
  console.log(findings.length ? `${findings.length} findings (${fails} FAIL, ${warns} WARN)` : 'OK  no findings')
  process.exitCode = fails ? 1 : 0
}
