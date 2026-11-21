# Subagent Preparation Pipeline

Status: proposed 2026-11-20.

## Problem Statement

One conversation prepares an entire Course. The concept graph is a long structured output, every draft shares the same context, and the agent that writes a lecture also checks it. A large Book spends one context window on research, planning, drafting, and review, so quality falls as the Book grows. The main agent also carries the learner conversation, so a long draft batch competes with the next teaching turn.

The host runs subagents in their own session. The skills already split draft work by Chapter when subagents exist, but research, graph building, figure drawing, and review stay in one lane.

## Solution

Preparation splits into six roles. Each role has one prompt file. The main agent keeps the learner conversation, every tracker write, and every evidence-bearing step.

| Role | Runs | Writes | Returns |
|---|---|---|---|
| `study-research` | Once per new Course, before the graph | `study/<course>/sources.md` | coverage, gaps, disagreements |
| `study-graph` | Once per new graph or graph change | nothing | concept table, chapter list, omitted topics |
| `study-draft` | Once per Chapter | the Chapter's lecture files | written paths, refused paths, figure requests |
| `study-figure` | Once after a draft batch | `study/<course>/diagrams/*.svg` | written paths, skipped requests |
| `study-proofread` | Once per Chapter batch | the same lecture files | mechanical fixes made, judgment calls |
| `study-consistency` | Once per Book, after proofreading | nothing | whole-Book defects |

The parent assembles every dispatch prompt from three parts: the shared header in `skills/study-plus/SKILL.md`, the role file verbatim, and the inputs for this run. The shared header carries the rules that apply to every role: no nested agents, no tracker access, no invented paths, no learner questions, no drafts in chat, and the required report shape.

## Pipeline

1. **Research.** After the Course is settled and before the graph, dispatch `study-research` when the host has a subagent tool. It uses supplied material first, then reliable sources when needed. It writes one `sources.md` with sourced points per Chapter. The file is working material: never evidence, never part of the Book.
2. **Graph.** Dispatch `study-graph` with the subject, `Goal`, `Background`, supplied material, and the `sources.md` path. It returns the concept table in prerequisite order, the Chapter list with outcome scopes, and one line per omitted topic. The parent checks coverage against `Goal`, shows the table, asks for approval, runs calibration, then writes `graph.md`, `state.md`, and `log.md` itself.
3. **Drafts.** Dispatch one `study-draft` per Chapter with disjoint destination lists. Each agent receives its Chapter's rows, the rows of every prerequisite outside the Chapter, the three brief lines verbatim, the relevant source note, and the explicit destinations.
4. **Figures.** Collect every figure request from the draft reports and dispatch `study-figure` once. The agent loads the `diagram` skill for visual rules, computes plotted points with the shell, and writes each SVG.
5. **Proofread.** Dispatch one `study-proofread` per Chapter batch, in parallel, with disjoint file lists. Each agent fixes mechanical defects in place and reports judgment calls.
6. **Consistency.** Dispatch one `study-consistency` over the whole Book after proofreading. It writes nothing.

A graph change reruns only the affected stages: no research, a graph agent that proposes only the changed part, a draft agent that rewrites only affected drafts, and proofreading only for the changed files. Consistency still reads the whole Book.

Fallbacks, in order:

- No subagent tool: the parent runs every step serially and says so in its report.
- A failed or empty agent: the parent writes that Chapter itself and names the failed lane.
- An agent without write access: it returns the complete text with each destination path, and the parent writes the files.
- An occupied or unrecognized destination: the agent leaves the file alone and reports the path.

## User Stories

1. As a learner, I want research to run once when a Course is created, so that later lectures reuse the same source note instead of repeating searches.
2. As a learner, I want the graph proposal to arrive as one reviewable table, so that approval is a single decision.
3. As a learner, I want drafts for separate Chapters to be written at the same time, so that a large Book finishes sooner.
4. As a learner, I want every figure to be drawn from a written request, so that a draft and its picture agree.
5. As a learner, I want typos and format fixed without another round with me, so that only real content questions reach the conversation.
6. As a learner, I want one whole-Book review for repeated examples and conflicting claims, so that a long Course stays coherent.
7. As a learner, I want the same result when the host has no subagent tool, so that the skills work everywhere.
8. As a learner, I want a failed preparation lane to name itself and not block the session, so that I can keep learning.

## Acceptance Criteria

1. A new Course on a host with a subagent tool produces `study/<course>/sources.md` before `graph.md`.
2. No subagent reads or writes `graph.md`, `state.md`, `log.md`, or `plan.md`.
3. `graph.md` is written by the main agent after learner approval and calibration.
4. Two draft agents never share a destination path.
5. Every draft carries `status: draft`, its concept number, one H1, and a practice block with a reasoned answer per item.
6. Each figure named in a draft exists at its path, or the missing figure is reported in one line.
7. Proofreading fixes typos, punctuation, term spelling, and format in place. It reports coverage gaps, prerequisite conflicts, and missing practice blocks.
8. The consistency review writes no file and reports defects with file and line.
9. With no subagent tool, every artifact is still produced and the report names the serial fallback.
10. A failed lane names the Chapter it lost, and the parent writes that Chapter.
11. Each role file states its inputs, its forbidden actions, and its return format. It carries no rule that belongs to another role.
12. The main agent resolves role files from the skill's base directory, never from the workspace.

## Implementation Decisions

**Prompt files.** `skills/study-plus/references/agents/` holds `research.md`, `graph.md`, `draft.md`, `figure.md`, `proofread.md`, and `consistency.md`. The draft contract is the writing standard, so its canonical copy is `skills/study/references/draft.md`. `study/SKILL.md` keeps a short section that points there. `skills/study-plus/references/agents/draft.md` is a two-line pointer to the canonical file. One standard, one copy.

**Path resolution.** Skill content loads with a base directory line. Role files and the draft standard resolve from that line, the way `answer-me-with-html` resolves its references. A path relative to the workspace does not work for an installed plugin.

**What stays in the main agent.** Course selection, the opening question, graph approval, calibration, `graph.md`/`state.md`/`log.md` writes, teaching, unseen questions, teach-back, grading, the session log, and the Book rebuild. These steps need the learner's answers or change evidence.

**Shared header.** `skills/study-plus/SKILL.md` carries one header block that every dispatch prompt starts with: role, no learner contact, no nested agents, no tracker files, no invented paths, no overwrite of a draft or dated lecture, return text when writes are unavailable, and the required report shape.

**`sources.md`.** One file at the Course root. It opens with the Course name and the date, then one section per Chapter. Each point names its source. A point that rests on supplied material names the file, not a URL. A disagreement between sources gets one line. The Book builder reads `lectures/` only, so the file never reaches the reader.

**Figure request.** Every draft agent ends its report with one block per figure:

```
Figure: <kebab-case name>
Shows: <one sentence>
Data: <exact values or plotted points, or "none">
After: <the section the figure supports>
```

**Concurrency.** One agent per Chapter, dispatched in waves that respect the host's limit. Agents never spawn agents. The host enforces a depth of one.

**Cost guards.** No research on a Course that already has `graph.md`. No research on a graph change. No draft agent runs for a Chapter with no missing draft.

**Graph agent output.** The agent returns Markdown the parent can show and then write. It does not write a file, because the table is the approval artifact and calibration follows approval.

## Testing Decisions

- Run `npm run check` for lint and the existing test suite. No new code ships, so the suite stays green without new tests.
- Prompt behavior has no automated harness in this repository. Validate it with two real runs in an isolated workspace, one with a subagent tool and one without.
- Each run uses a two-Chapter Course with one figure per Chapter. Check for `sources.md`, the approved graph, disjoint draft paths, the figure files, proofread edits, and the consistency report.
- The serial run must produce the same artifacts and name the fallback in its report.

## Out of Scope

- Registering the roles as DSH presets. The skill provider packages skills only, and preset injection from a plugin is unverified.
- Delegating teaching, questions, teach-back, or grading. These need the learner's answers and change evidence.
- Changing the tracker format, the session flow, or the Book builder.
- Parallel drafts inside one Chapter.
- Fixing the existing `build-book.mjs` path in `skills/study-plus/SKILL.md`, which assumes the repository root. It needs its own ticket.

## Further Notes

- Planned release: `0.6.1`. The version bump, the changelog section, and the two skill description markers land with the implementation, not with this spec.
- This decision needs an ADR: `docs/adr/0025-preparation-runs-as-subagent-roles.md`.
- The glossary gains `Source note`, `Figure request`, `Proofread`, and `Consistency review`.
- Three roles were considered and left out. An assessment designer would keep graded questions away from drafts, but the parent plans those questions at teaching time and a second writer adds a lane for no artifact. A fact checker would re-read every draft, but proofreading already names unsupported claims, and research already cites load-bearing ones. A terminology warden would check names against the graph, but the consistency review covers term drift over the whole Book.
- The skill catalog stays at its current size. Roles are reference files, not new skills, because ADR 0007 holds the catalog small on purpose.
