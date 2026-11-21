# Role file: study-figure

Status: resolved
Blocked by: 02

## Goal

Write `skills/study-plus/references/agents/figure.md`: the role that turns the figure requests from a draft batch into SVG files.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Pipeline step 4, `Figure request` in §Implementation Decisions, and §Acceptance 6.
- The figure request block the draft emits: `skills/study/references/draft.md` §Report.
- The path and backup rules the main agent already follows: `skills/study/SKILL.md` §Files and figures, and `skills/study-plus/SKILL.md` §5 Teach.
- Shared header, role table, and base-directory rule: `skills/study-plus/SKILL.md` §9.
- House voice: `skills/study-plus/SKILL.md` and `skills/study/references/draft.md`.

## Shape

`# Figure`, then exactly `## Inputs`, `## Do`, `## Do not`, `## Report`, in that order. 25 to 60 lines. English, imperative, terse.

Do not restate the universal bans from the header. `## Do not` lists only this role's forbidden actions. Do not mention this ticket.

## Content the file must carry

### Inputs

The figure request blocks with their four fields (`Figure`, `Shows`, `Data`, `After`), the Course's `diagrams/` root, and the Chapter each request belongs to.

### Do

- Load the `diagram` skill for the visual authoring rules. Use the study path below, not its generic default.
- Write one SVG per request at `study/<course>/diagrams/<name>.svg`, where `<name>` is the request's `Figure` value as one lowercase kebab-case path segment with no slashes and no dot segments.
- Compute every plotted point with the shell: `pwsh` on Windows, `bash` on macOS or Linux. Read the result back and put those exact values in the SVG. Never place a point by eye, and never round a value the request gives.
- Write `Data: none` as a diagram with no plotted values. Draw the relation the `Shows` line names.
- Before replacing an SVG of the same name, copy the old file to `<name>.svg.bak`, replacing any older backup.
- Before writing, confirm the resolved parent stays inside the Course's `diagrams/` root, and that the target is not `graph.md`, `state.md`, `log.md`, or `plan.md`.
- Make the figure agree with its request. When the request is ambiguous, draw the narrowest relation its `Shows` line supports and say so in `Judge`.

### Do not

- Write outside the Course's `diagrams/`.
- Draw a request that has no `Shows` line. Report it as skipped.
- Add a figure nobody requested, or a second figure for one request.
- Put lecture prose in the SVG. One caption sentence, or the labels the figure needs.
- Change a value that the request gives.

### Report

`Result`, `Wrote`, `Refused`, `Judge` from the header, then these lines:

- `Skipped: <figure name> - <reason>` for every request you did not draw, or `Skipped: none`.
- `Rewrite: <figure name> - <what the draft must change>` when the request cannot agree with the draft.

## Acceptance

- The file exists, is English, and has exactly the four H2 sections.
- It names the `diagram` skill, the destination pattern, the kebab-case rule, the shell rule, and the `.svg.bak` rule.
- It states the `Data: none` case and the missing-`Shows` case.
- It repeats no rule from the header.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `7674ce7`.

`skills/study-plus/references/agents/figure.md` lands the role: the four request fields, the `diagram` skill, the `diagrams/` destination, kebab-case names, shell-computed points, the `Data: none` case, the `.svg.bak` rule, and the `Skipped` report. The speculative `Rewrite` line was dropped in review because no step consumed it.
