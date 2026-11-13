---
name: diagram
description: Use when parts and their connections explain an idea better than prose, or when the learner asks to draw, sketch, plot, chart, or visualize something. Draws a self-contained SVG, saves it, and embeds it in the reply.
---

# Diagram

A picture earns its place when the reader has to hold two things at once: the parts, and how they connect. Draw when the answer is about a relation, a flow, a hierarchy, a sequence over time, or two quantities moving together.

Do not draw a list. If the content is a sequence of steps with no branching, a numbered list reads faster. One figure carries one idea; split rather than crowd.

## Before you draw

Name the one relation the figure must show, in one sentence. List the nodes and the arrows between them. If the list passes 12 nodes, split the figure.

Pick the shape from the relation, not from the topic. Decide the one accent: which node or arrow is the point. Every accent class you use gets a role you can name; most figures need one, a comparison may need two.

When the figure would need a second paragraph to explain, draw two figures.

## Pick the shape

- **Flow**: what happens in order. Three to five boxes left to right, an arrow between each, a dashed return edge for the retry path.
- **Hierarchy**: what contains what. One root at the top, two to four children below it, elbow connectors.
- **State**: what can change, and what triggers it. Rounded boxes, arrows labelled with the trigger, a loop back for "stays the same".
- **Timeline**: what happens when. A horizontal axis with ticks, labels alternating above and below the line.
- **Comparison**: two things on the same rows. One accent class per side, equal row heights.
- **Plot**: one quantity against another. Axes with ticks, one accent line, both axes labelled with symbol and unit.

When two shapes fit, take the one with fewer boxes.

## Draw it

Write the SVG file first, then talk about it.

1. Write `diagrams/<name>.svg`, a relative path in the working directory. Use a short kebab-case name that says what the figure shows, such as `gradient-update.svg`.
2. In the reply, put the image on its own line: `![<what it shows>](diagrams/<name>.svg)`.
3. Put one caption sentence after it that states the point the picture makes. Keep the prose around it short; the figure carries the detail.
4. Embed the figure in the section whose step it illustrates, not in a gallery at the end.

The Markdown path is resolved against the working directory and served from disk, so it must be a file that exists when the message renders. Write the file before the sentence that shows it. No query string, no fragment, no `data:` URL: the renderer rejects all three and shows the alt text instead. To revise a figure, overwrite the file; if the learner still sees the old picture, write a new name.

## The floor

Non-negotiable, every figure:

- The canvas is 720 wide. The root carries `xmlns`, `viewBox`, `width` and `height` in pixels, `role="img"`, and a non-empty `aria-label`.
- One `<style>` block holds the palette classes and the dark-mode override. No other style block.
- `font-family="Segoe UI, Inter, system-ui, sans-serif"` sits on every text group.
- Arrowheads are `<marker>` elements in `<defs>`, referenced with `marker-end`.
- Colors come only from the palette classes. No raw hex or named color outside `<style>`. No gradients, shadows, 3D, icons, emoji, or decorative marks.
- One accent class, one meaning, for the whole figure. At most four accent classes; most figures need one.
- Every label fits its box: 13px, at most two lines. At 13px a Latin line runs about 7.2px per character and a CJK line about 13px. A box needs `7.2 × Latin characters + 13 × CJK characters + 36`.
- Every arrow lands on a border with clearance. No wire crosses a label. No orphan node.
- No relation the source does not state. No invented number, name, or arrow.
- No `<script>`, `<foreignObject>`, external `href`, `@import`, animation, or LaTeX delimiter. Formulas are plain Unicode text inside `<text>`.
- The `aria-label`, the Markdown alt text, and the caption sentence agree.
- The figure says one thing.

A browser renders the file as an isolated image. It inherits no page CSS and no page font, so every color and every glyph has to be stated in the file.

## Layout budget

Work in a 720 wide canvas; height is whatever the content needs plus 40.

- Panel: a rounded `<rect>` inset by 0.75, `rx="12"`.
- Title at 15px bold, baseline `y=40`, left margin 28.
- Node: 60 tall, `rx="8"`, 42 to 50 of gap between nodes. Three across fit as 180 wide boxes at x=28, 270, 512.
- Node label 13px, sub-label 12 to 13px in the muted color, both anchored `middle`.
- Measure before you place: at 13px Segoe UI a Latin line runs about 7.2px per character, a CJK line about 13px. A box must be at least `7.2 × Latin characters + 13 × CJK characters + 36` wide, and a node holds at most two lines.
- Arrows land on a box edge with a few pixels of clearance, never inside the box.
- Keep it under about 12 nodes. Past that the figure stops being readable at chat width.

## Palette

Copy these classes verbatim and use them; they carry the dark-mode overrides.

```svg
<style>
  .panel { fill: #ffffff; stroke: #e2e8f0; }
  .title { fill: #0f172a; }
  .label { fill: #1e293b; }
  .sub { fill: #475569; }
  .note { fill: #64748b; }
  .wire { stroke: #94a3b8; }
  .head { fill: #94a3b8; }
  .b1 { fill: #2563eb; fill-opacity: .08; stroke: #2563eb; }
  .b2 { fill: #b45309; fill-opacity: .08; stroke: #b45309; }
  .b3 { fill: #15803d; fill-opacity: .08; stroke: #15803d; }
  .b4 { fill: #6d28d9; fill-opacity: .08; stroke: #6d28d9; }
  @media (prefers-color-scheme: dark) {
    .panel { fill: #17191d; stroke: #2c313a; }
    .title { fill: #f1f3f7; }
    .label { fill: #e6e9ef; }
    .sub { fill: #a6afbd; }
    .note { fill: #8a94a3; }
    .wire { stroke: #5b6675; }
    .b1 { fill: #4c8dff; fill-opacity: .12; stroke: #4c8dff; }
    .b2 { fill: #d98324; fill-opacity: .12; stroke: #d98324; }
    .b3 { fill: #3fa86a; fill-opacity: .12; stroke: #3fa86a; }
    .b4 { fill: #a78bfa; fill-opacity: .12; stroke: #a78bfa; }
    .head { fill: #5b6675; }
  }
</style>
```

Class `b1` to `b4` mark four distinct things. Give one class one meaning for the whole figure, and when the figure has a legend, build it from the same classes. `note` is for edge labels and footnotes; `wire` styles connectors; `head` fills the arrowhead.

## Starter

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 250" width="720" height="250" role="img" aria-label="The full pass, run once per unit: explain it, name the gap, explain it again, and repeat until the explanation holds">
  <style>…the palette above…</style>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="head" d="M0 0 L10 5 L0 10 z"/>
    </marker>
  </defs>
  <rect class="panel" x="0.75" y="0.75" width="718.5" height="248.5" rx="12" stroke-width="1.5"/>
  <text class="title" x="28" y="40" font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="15" font-weight="600">The full pass, run once per unit</text>

  <g font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="13">
    <rect class="b1" x="28" y="72" width="180" height="60" rx="8" stroke-width="1.5"/>
    <text class="label" x="118" y="98" text-anchor="middle" font-weight="600">Explain it</text>
    <text class="sub" x="118" y="117" text-anchor="middle">in your own words</text>

    <rect class="b2" x="270" y="72" width="180" height="60" rx="8" stroke-width="1.5"/>
    <text class="label" x="360" y="98" text-anchor="middle" font-weight="600">Name the gap</text>
    <text class="sub" x="360" y="117" text-anchor="middle">without fixing yet</text>

    <rect class="b3" x="512" y="72" width="180" height="60" rx="8" stroke-width="1.5"/>
    <text class="label" x="602" y="98" text-anchor="middle" font-weight="600">Explain again</text>
    <text class="sub" x="602" y="117" text-anchor="middle">after the fix</text>
  </g>

  <g class="wire" stroke-width="1.5" fill="none">
    <line x1="212" y1="102" x2="262" y2="102" marker-end="url(#arrow)"/>
    <line x1="454" y1="102" x2="504" y2="102" marker-end="url(#arrow)"/>
    <path d="M602 140 C602 195 118 195 118 140" stroke-dasharray="5 4" marker-end="url(#arrow)"/>
  </g>
  <text class="note" x="360" y="214" text-anchor="middle" font-family="Segoe UI, Inter, system-ui, sans-serif" font-size="12">repeat until the explanation holds</text>
</svg>
```

## Verify

Run the checker after writing the file:

```text
node <skill-dir>/scripts/check-svg.mjs diagrams/<name>.svg
```

`<skill-dir>` is the folder that holds this SKILL.md.

Fix every FAIL and run it once more. A WARN is a question: fix it, or say why it is intentional.

The checker measures text, not pixels. When a browser is available, open the SVG and look at it. Check it at 720 wide and at 360 wide: the whole figure scales by half, so a 13px label reads at 6.5px. If that is too small for the material, split the figure or draw a simpler one. Do not shrink the text below 13px at 720.

A clean lint is not a good figure. The last check is the reader's: can they name the one thing the figure shows without reading the caption?
