# Role file: study-graph

Status: resolved
Blocked by: 02

## Goal

Write `skills/study-plus/references/agents/graph.md`: the role that proposes the concept graph and the Chapter list, and writes no file.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Pipeline step 2, `sources.md` and `Graph agent output` in §Implementation Decisions, and §Acceptance 3.
- Shared header, role table, and base-directory rule: `skills/study-plus/SKILL.md` §9.
- The graph format the parent writes: `skills/study-plus/SKILL.md` §8.
- House voice: `skills/study-plus/SKILL.md` and `skills/study/references/draft.md`.

## Shape

`# Graph`, then exactly `## Inputs`, `## Do`, `## Do not`, `## Report`, in that order. 30 to 70 lines. English, imperative, terse.

Do not restate the universal bans from the header. `## Do not` lists only this role's forbidden actions. Do not mention this ticket.

## Content the file must carry

### Inputs

The subject, the `Goal` and `Background` lines, the supplied material, the `sources.md` path, and, for a change, the existing concept table plus the requested change.

### Do

- Read `sources.md` before you propose anything. Prefer a source over your own recollection.
- Return a concept table in prerequisite order, with the columns `#`, `Concept`, `Definition`, `Prerequisites`, `Chapter`, `Section`. Number rows from 1. A row's prerequisites reference earlier row numbers only. A one-line definition per row.
- Return `## Chapters` as `1. <title>: <scope>` rows in book order, when the Course has two or more Chapters. Write each scope as the outcome the Chapter delivers, not a list of topics. Number Sections from 1 within each Chapter, in textbook order.
- Keep prerequisite order separate from reading order. A concept may appear later than its prerequisite and belong to another Chapter.
- Check alignment before you return: every Chapter scope names an outcome, every outcome has a concept that teaches it, and every row sits in exactly one Chapter and one Section.
- Return one `Omitted:` line per topic the graph leaves out, with the reason this Course does not need it.
- On a change request, return only the changed part: added rows, removed rows, renamed rows, and moved rows. Keep the number of an unchanged concept.

### Do not

- Write a file, a tracker file, or `graph.md`.
- Return `# Course:`, `Goal`, `Background`, or `Teaching level`: the parent writes those after calibration.
- Ask the learner anything, or ask for approval.
- Put a concept in the table whose outcome no Chapter claims, or a Chapter whose outcome no concept teaches.
- Add a topic outside the `Goal` to look complete.
- Cite a source that `sources.md` does not carry.

### Report

`Result`, `Wrote` (always `none`), `Refused` (always `none`), `Judge` from the header. Below `Judge`, return the graph Markdown itself: the `## Chapters` list first when it exists, then the table, then the `Omitted:` lines.

Anything the parent must decide, such as a prerequisite cycle at depth two or a rename that needs an explicit mapping, goes in `Judge` as one line.

## Acceptance

- The file exists, is English, and has exactly the four H2 sections.
- It fixes the table columns, the row numbering, the prerequisite rule, and the Chapter row shape.
- It states that the role writes nothing and omits the three brief lines.
- It states the change-request behaviour and the numbering rule for unchanged concepts.
- It repeats no rule from the header.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `89b6f07`.

`skills/study-plus/references/agents/graph.md` lands the role: table columns, row numbering, the prerequisite rule, the Chapter row shape, the omitted-topic line, and the change-request rule that keeps untouched numbers. It writes nothing and returns the Markdown the parent shows and then writes. Later commits keep the `sources.md` section titles as the Chapter titles.
