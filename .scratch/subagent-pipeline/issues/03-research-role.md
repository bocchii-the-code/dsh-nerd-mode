# Role file: study-research

Status: resolved
Blocked by: 02

## Goal

Write `skills/study-plus/references/agents/research.md`: the role that produces one source note per Course, before the concept graph exists.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Solution, §Pipeline step 1, and the `sources.md` part of §Implementation Decisions.
- Shared header, role table, and base-directory rule: `skills/study-plus/SKILL.md` §9.
- House voice: `skills/study-plus/SKILL.md` and `skills/study/references/draft.md`.

## Shape

`# Research`, then exactly `## Inputs`, `## Do`, `## Do not`, `## Report`, in that order. 25 to 60 lines. English, imperative, terse, one idea per sentence.

Do not restate the universal bans from the header. `## Do not` lists only this role's forbidden actions. Do not mention this ticket.

## Content the file must carry

### Inputs

The Course name, the subject, the `Goal` and `Background` lines, the supplied material (paths or pasted text), the Chapter list with scopes, and the destination `study/<course>/sources.md`.

### Do

- Use the supplied material first. Search the web or the literature only for a load-bearing point that the supplied material does not answer.
- Write one file at the destination. It opens with `# Sources: <Course name>` and `Date: <YYYY-MM-DD>`.
- Then one `## <Chapter title>` section per Chapter, in book order.
- One bullet per point: the point in one sentence, then its source. A point that rests on supplied material names the file, not a URL. A web or book source names the site or author, the title, and the date read.
- Write `Gap: <what is missing>` in a Chapter section when no source covers an outcome the Chapter claims.
- Write `Disagreement: <claim> (<source>) vs <claim> (<source>)` on one line when two sources conflict in a way that changes the lesson.
- Name the source of every load-bearing number, definition, and causal claim. Mark a fact that only one weak source carries.
- Say what is unknown. Never fill a gap silently.

### Do not

- Write teaching prose, exercises, figures, or lecture text.
- Cite a source you did not read, or invent a title, author, or URL.
- Pad the note with a source that carries no point.
- Write a second file.
- Take a position on a disagreement when the evidence does not settle it.

### Report

`Result`, `Wrote`, `Refused`, `Judge` from the header, then these lines:

- `Coverage: <Chapter title> - covered | partial | missing`
- `Gaps: <one line per gap, or "none">`
- `Disagreements: <one line per conflict, or "none">`

## Acceptance

- The file exists, is English, and has exactly the four H2 sections.
- It says supplied material comes first and names the file for such a point.
- It gives the exact `sources.md` shape, including the date and one section per Chapter.
- It states the report lines below `Judge`.
- It repeats no rule from the header.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `a9f9478`.

`skills/study-plus/references/agents/research.md` lands the role: inputs, supplied-material-first rule, one `sources.md` with a date and one section per Chapter, gaps and disagreements, and the report lines below `Judge`. Later commits add the date source (host clock) and the Chapter-title handoff, so the role works before the graph exists.
