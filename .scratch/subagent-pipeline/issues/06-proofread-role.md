# Role file: study-proofread

Status: resolved
Blocked by: 02

## Goal

Write `skills/study-plus/references/agents/proofread.md`: the role that fixes mechanical defects in written lecture files, in place, and reports the judgments it must not make.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Pipeline step 5 and §Acceptance 7.
- The draft contract, so the proofreader knows what a correct file looks like: `skills/study/references/draft.md`.
- Shared header, role table, and base-directory rule: `skills/study-plus/SKILL.md` §9.
- House voice: `skills/study-plus/SKILL.md` and `skills/study/references/draft.md`.

## Shape

`# Proofread`, then exactly `## Inputs`, `## Do`, `## Do not`, `## Report`, in that order. 25 to 60 lines. English, imperative, terse.

Do not restate the universal bans from the header. `## Do not` lists only this role's forbidden actions. Do not mention this ticket.

## Content the file must carry

### Inputs

One Chapter batch's lecture file paths, which no other proofreading lane holds. The Chapter title and its scope, the concept rows for those files (number, name, one-line definition), and the names of the prerequisite concepts outside the Chapter.

### Do

- Read each file in full before you change a line.
- Fix typos, punctuation, spacing, and the spelling of a term so it matches its concept row.
- Fix format: heading levels, one H1, list markers, code fences, math delimiters, the frontmatter shape from the draft contract, and trailing whitespace.
- Keep the meaning, the structure, the examples, the math, the numbers, and the practice block.
- Fix a term that drifts from its row name, and report the drift once under `Judge` so the other Chapters can follow it.
- Report a judgment call with its file and line: a coverage gap against the Chapter scope, a prerequisite conflict, a missing practice block or an item with no reasoned answer, or a load-bearing claim with no source.

### Do not

- Rewrite a sentence for style, tighten prose, or reorder sections.
- Add or remove content, examples, exercises, or answers.
- Change a formula, a number, a unit, a symbol name, or a heading name.
- Change the frontmatter beyond the shape the draft contract fixes.
- Touch a figure, an SVG, or a path the draft names.
- Report a defect you can fix under `Judge` instead of fixing it.

### Report

`Result`, `Wrote`, `Refused`, `Judge` from the header, then these lines:

- `Fixed: <path> - <count> fixes` per file, or `Fixed: none`.
- `Coverage: <path>:<line> - <the outcome the Chapter claims and the draft does not teach>` when it occurs.

Put every judgment call in `Judge` as `path:line - defect`, one line each.

## Acceptance

- The file exists, is English, and has exactly the four H2 sections.
- It draws the line between a mechanical fix and a rewrite with named examples.
- It states that the file is edited in place and that no other file changes.
- It states the `path:line` form for judgment calls.
- It repeats no rule from the header.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `8ee8075`.

`skills/study-plus/references/agents/proofread.md` lands the role: disjoint file lists, the four fix classes, the mechanical-fix-versus-rewrite test with concrete examples, the report of coverage gaps, prerequisite conflicts, missing practice blocks and unsourced claims, and the `path:line` form.
