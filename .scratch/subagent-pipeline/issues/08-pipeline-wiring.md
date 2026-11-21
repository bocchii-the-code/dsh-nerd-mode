# Wire the six roles into the session flow

Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 07

## Goal

`skills/study-plus/SKILL.md` runs the preparation pipeline: research, graph, drafts, figures, proofread, consistency, with the fallbacks and cost guards. The main agent keeps the learner conversation and every tracker write.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`. Read §Pipeline, §Fallbacks, §Implementation Decisions, and §Acceptance 1 to 10.
- Sections 9, 2, and 3 of `skills/study-plus/SKILL.md` already carry the role table, the header block, and the base-directory rule. Do not move them.
- Role files: `skills/study-plus/references/agents/*.md`.

## Files

`skills/study-plus/SKILL.md` only.

## Work

### Section 2, new graph

- Add a research step before step 1: dispatch `study-research` when the host has a subagent tool. It runs once per new Course and writes `study/<course>/sources.md`. It never runs on a Course that already has `graph.md`, and never on a graph change.
- Replace the "make a concept table" step with a `study-graph` dispatch. Pass the subject, `Goal`, `Background`, the supplied material, and the `sources.md` path.
- Keep the parent's work: check coverage against `Goal`, show the table, ask for approval, run calibration, then write `graph.md`, `state.md`, and `log.md`. State that the graph agent writes nothing.
- Section 2, graph change: add only the affected stages. No research. The graph agent proposes only the changed part. A draft agent rewrites only the affected drafts. Proofreading covers only the changed files. Consistency still reads the whole Book.

### Section 3, drafts

- Replace the current step 3 with the dispatch. One `study-draft` per Chapter, in waves that respect the host's limit. Each agent gets its Chapter's rows, the rows of every prerequisite outside the Chapter, the three brief lines verbatim, the relevant `sources.md` section, and an explicit destination list. Two agents never share a destination path.
- Add the figure step after the draft batch: collect every figure request from the draft reports and dispatch `study-figure` once. Each draft's figure must exist at its path, or the missing figure is reported in one line.
- Add proofreading: one `study-proofread` per Chapter batch, in parallel, with disjoint file lists.
- Add the consistency step: one `study-consistency` over the whole Book after proofreading. It writes nothing.
- Keep the existing checks, the preserve rule, the report rules, and the Book rebuild. A review pass never blocks the report.

### Section 9

- Add a short `### Fallbacks` list, in order: no subagent tool, so the parent runs every step serially and says so in its report; a failed or empty agent, so the parent writes that Chapter and names the failed lane; an agent without write access, so it returns the full text and the parent writes the files; an occupied or unrecognized destination, so the agent leaves it and reports the path.
- Add a short `### Cost guards` list: no research on a Course that already has `graph.md`; no research on a graph change; no draft agent for a Chapter with no missing draft.
- State that agents never spawn agents, and the host enforces a depth of one.

## Rules

- Keep the house voice: imperative, terse, one idea per sentence. Do not add a paragraph that restates the header block.
- Do not renumber the existing sections.
- Do not add a rule that contradicts `skills/study/references/draft.md`.
- `test/prompt-consistency.test.mjs` must stay green. It checks §2 for "full graph and chapter layout in the reply before the approval question" and "Do not put the table in the question text", and it forbids a backticked `` `question` `` in this file.

## Acceptance

- A new Course dispatches research before the graph, and `graph.md` is written by the parent after approval and calibration.
- No dispatch prompt grants tracker access.
- Section 3 names the disjoint destination rule and the figure, proofread, and consistency steps.
- The four fallbacks and three cost guards are present in section 9.
- `npm run check` passes.

## Answer

Resolved on `feat/preparation-pipeline` in `a5a1c5b`.

`skills/study-plus/SKILL.md` runs the pipeline: research and graph dispatch in section 2, wave-free parallel drafts with disjoint destinations in section 3, then figures, proofreading, and the consistency review. Section 9 gains the fallbacks and the cost guards. `36d0a47` closes the review findings: the no-drafts-in-chat header rule, parent-side `${CLAUDE_SKILL_DIR}` substitution, one destination per figure request, Chapter titles taken from the source note, and the header report shape for drafts.
