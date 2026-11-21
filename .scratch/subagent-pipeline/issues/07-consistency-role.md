# Role file: study-consistency

Status: resolved
Blocked by: 02

## Goal

Write `skills/study-plus/references/agents/consistency.md`: the whole-Book review that finds defects no single-file proofreader can see, and writes nothing.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Pipeline step 6 and §Acceptance 8.
- The writing standard a lecture must hold to: `skills/study/SKILL.md` and `skills/study/references/draft.md`.
- Shared header, role table, and base-directory rule: `skills/study-plus/SKILL.md` §9.
- House voice: `skills/study-plus/SKILL.md` and `skills/study/references/draft.md`.

## Shape

`# Consistency`, then exactly `## Inputs`, `## Do`, `## Do not`, `## Report`, in that order. 25 to 60 lines. English, imperative, terse.

Do not restate the universal bans from the header. `## Do not` lists only this role's forbidden actions. Do not mention this ticket.

## Content the file must carry

### Inputs

Every lecture path in the Book, in book order. The concept rows: number, name, one-line definition, prerequisite numbers, Chapter, and Section.

### Do

- Read every file in book order before you judge anything.
- Report these defects, each with the file and line where the problem shows:
  - a lecture that uses an idea its prerequisite does not teach, or teaches it in an order the graph contradicts;
  - one example, dataset, or story reused in two Chapters with no pointer from the second;
  - one concept under two names, or two concepts under one name;
  - a term whose definition differs between Chapters;
  - a claim that one Chapter contradicts without saying it disagrees;
  - a cross-reference to a section, figure, or concept that does not exist.
- Rank the report: a defect that mis-teaches first, a repeated example second, a naming or reference defect third.
- State the second location for every conflict: `path:line` for both sides.

### Do not

- Write or edit any file, including a report file.
- Report a typo, a punctuation error, or a format defect: proofreading owns those.
- Report a style preference, a length, or a missing optional section.
- Report the same defect twice from its two sides. One entry names both.
- Judge a single file in isolation.

### Report

`Result`, `Wrote` (always `none`), `Refused` (always `none`), `Judge` from the header, then one line per defect:

```
<path>:<line> - <defect> (<other path>:<line> when it conflicts with another file)
```

Write `Defects: none` when the Book is clean. Add no other section.

## Acceptance

- The file exists, is English, and has exactly the four H2 sections.
- It covers all six defect classes and gives the two-location rule.
- It states that the role writes nothing and does not duplicate proofreading.
- It states the ranked report and the clean-Book line.
- It repeats no rule from the header.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `62261b4`.

`skills/study-plus/references/agents/consistency.md` lands the role: the six defect classes, the two-location rule, the ranked report, the `Defects: none` clean line, and the ban on duplicating proofreading. It writes nothing.
