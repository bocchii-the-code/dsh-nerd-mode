# Shared Preparation Agents and Quick Mode

Status: ready-for-agent
Date: 2026-11-20

## Problem Statement

A learner has two paths. `study` answers one concept or one task and keeps no record. `study-plus` runs a tracked Course. Today the tracked path owns the six preparation roles, and the quick path owns the writing standard. Every tracked lecture loads the other skill to get that standard, and two role files read across the skill boundary.

The coupling has three costs for the learner and the maintainer:

- A skill folder cannot move or install without breaking a path in the other one.
- The quick path cannot prepare material the way the tracked path does. It writes inline, one concept at a time, with no parallel chapter work and no separate figure or proofreading pass.
- A rule change has to be checked in two skill folders, and the role files still reach the standard through a relative path.

The learner also has no place for quick-mode material. A one-off lecture either stays in chat or lands at a path the learner must choose. Nothing separates generated quick material from the issue tracker under `.scratch/` or from a Course record under `study/<course>/`.

## Solution

One shared pool at the plugin root holds the writing standard and the six preparation roles. Neither skill owns the pool, and neither skill reads the other skill's folder. `study-plus` stops loading `study`; it reads the shared standard for Teach and for drafts. `study` becomes quick mode: it prepares a lecture through the same roles, always, and then teaches from the returned draft.

Quick mode writes to `.material/<slug>/` in the workspace. The folder holds lectures and diagrams, is ignored by git, and is never a Course record. The tracker boundary stays where it is: only `study-plus` reads or writes `graph.md`, `state.md`, and `log.md`.

The layout is the decision, not an incidental path:

```text
<package>/
├── agents/
│   ├── orchestrator.md
│   ├── research.md
│   ├── graph.md
│   ├── lecture.md
│   ├── figure.md
│   ├── proofread.md
│   └── consistency.md
└── skills/
    ├── study/SKILL.md
    └── study-plus/SKILL.md

<workspace>/
├── .material/<slug>/
│   ├── lectures/<NN>-<concept-slug>.md
│   └── diagrams/<name>.svg
└── study/<course>/          # tracked record, study-plus only
```

| Role | Dispatched by | Runs | Writes | Returns |
|---|---|---|---|---|
| `study-research` | `study-plus` | Once per new Course, before the graph | `study/<course>/sources.md` | coverage, gaps, disagreements |
| `study-graph` | `study-plus` | Once per new graph or graph change | nothing | concept table, chapter list, omitted topics |
| `study-lecture` | both skills | Once per Chapter or once per quick request | the lecture files | written paths, refused paths, figure requests |
| `study-figure` | both skills | Once after a lecture batch | the diagrams folder | written paths, skipped requests |
| `study-proofread` | both skills | Once per Chapter batch | the same lecture files | mechanical fixes, judgment calls |
| `study-consistency` | `study-plus` | Once per Book, after proofreading | nothing | whole-Book defects |

## User Stories

1. As a learner asking one concept, I want the guide to prepare a complete draft before it teaches, so that the explanation is complete and consistent.
2. As a learner asking a multi-chapter quick book, I want the chapters prepared in parallel, so that I do not wait for each chapter in turn.
3. As a learner, I want a figure drawn by a dedicated role, so that a process or relation is shown instead of described.
4. As a learner, I want a proofreading pass before the lecture reaches me, so that typos and broken formatting do not distract.
5. As a learner repeating a request, I want the earlier lecture kept as a backup, so that a re-run does not destroy it.
6. As a learner, I want quick mode to leave no Course record, so that a one-off request does not create tracker files.
7. As a learner, I want a task request to skip the lecture pipeline, so that a quick task stays quick.
8. As a tracked learner, I want `study-plus` to teach from the same standard without loading the other skill, so that the two paths cannot drift.
9. As a tracked learner, I want my `graph.md`, `state.md`, and `log.md` untouched by quick mode, so that my record stays trustworthy.
10. As a tracked learner, I want my existing Course to keep its files and states, so that this change is not a migration.
11. As a course author, I want research, graph, and consistency to keep their behavior, so that existing Courses keep working.
12. As a plugin maintainer, I want one copy of the lecture standard, so that a rule change lands once.
13. As a plugin maintainer, I want no skill file to name a path in the other skill folder, so that moving a skill cannot break a read.
14. As a plugin maintainer, I want the contract test to fail on a new cross-skill path, so that the coupling cannot return silently.
15. As an agent author, I want one shared orchestrator file, so that report shape and bans stay identical in both skills.
16. As an agent author, I want every dispatched prompt to carry resolved paths, so that a role never sees an unresolved token.
17. As a learner without a subagent tool, I want the skill to write the material itself, so that the feature still works.
18. As a learner, I want `.material` excluded from git, so that generated lectures do not appear as uncommitted work.
19. As a maintainer, I want the version markers, changelog, ADR, and package whitelist to move together, so that the installed plugin contains the shared files and shows the right version.
20. As a learner, I want the routing text to describe the new behavior, so that the guide and the tracked path are chosen correctly.
21. As an operator, I want the published package to include the shared pool, so that an installed copy resolves every role.
22. As a maintainer, I want the glossary to define the new terms, so that later specs use one vocabulary.

## Implementation Decisions

1. **Shared pool.** The package root gains `agents/`. It holds `orchestrator.md` and six role files: `research.md`, `graph.md`, `lecture.md`, `figure.md`, `proofread.md`, and `consistency.md`. The old `draft.md` disappears. No skill folder holds a role file.

   Every file in `agents/` opens with YAML frontmatter, then one H1. The frontmatter carries `name` and `description`. The name is the role name. The description is one sentence: what the role produces, for what, and what it must not write. The same rule applies to `orchestrator.md`, with `name: orchestrator`.

   ```yaml
   ---
   name: study-research
   description: "Write the source note for one Course before the concept graph exists."
   ---
   # Research
   ```

2. **One lecture standard.** `lecture.md` has three parts, in this order: the teaching and writing standard, the draft contract, and the draft role instructions. The parent reads the first two for Teach. A dispatch pastes the whole file, so the role receives the standard and the contract in one read.

3. **Shared orchestrator file.** `orchestrator.md` holds the report shape and the bans that apply to every role: no learner contact, no nested agents, no tracker access, no invented paths, no overwriting an occupied destination, and text fallback when writes fail. The file is neutral between a Course and a quick request.

4. **Path rule.** Both skills resolve the pool from the skill base directory, as `<skill base>/../../agents/<file>`. The parent replaces `${CLAUDE_SKILL_DIR}` with the real path before pasting. Neither a role file nor a skill resolves a role from the workspace.

5. **Decouple `study-plus`.** Remove the load of `study` from the Teach step and the draft step. Point the role table and every dispatch instruction at the shared pool. Keep tracker ownership, lecture paths, book assembly, and the five-step flow unchanged.

6. **Quick mode dispatch.** For a teaching request that produces a lecture, `study` dispatches `lecture` always, then `figure` when the lecture role reports figure requests, then `proofread` over the produced files. It reads the returned files and teaches from them. It dispatches no research, graph, or consistency role. A task request with no lecture runs directly.

7. **Quick mode output.** Lectures go to `.material/<slug>/lectures/<NN>-<concept-slug>.md`. Diagrams go to `.material/<slug>/diagrams/<name>.svg`. The slug is lowercase kebab-case from the request subject and is sanitized as one path segment. A re-run with the same slug replaces a file only after copying the old file to `.bak`. A different subject gets a new folder.

8. **Git boundary.** Add `.material/` to `.gitignore`.

9. **Tracker boundary.** Only `study-plus` reads or writes `study/<course>/graph.md`, `state.md`, `log.md`, and the inert `plan.md`. Quick mode never reads or writes them, and it does not create `study/<course>/`.

10. **Fallbacks.** With no subagent tool, the parent writes all material itself and says so. A failed or empty role means the parent writes that piece and names the failure. A role without write access returns complete text, and the parent writes the files.

11. **Package surface.** Add `agents` to the npm `files` whitelist. The pool is not a skill: it gets no `SKILL.md`, no slash command, and no catalog entry.

12. **Release.** Version 0.7.0. Both skill descriptions carry `[v0.7.0]`. The changelog gains a `## [0.7.0]` section. ADR 0028 records this change. The glossary gains entries for preparation role, shared standard, quick mode, and `.material`, and the `study` entry stops claiming ownership of the writing standard. Both READMEs and the profile overlay are updated. No tag and no publish in this change.

13. **Compatibility.** Existing Courses keep their files and states. No migration runs. The tracked folder layout is unchanged.

14. **Names.** The roles stay `study-research`, `study-graph`, `study-lecture`, `study-figure`, `study-proofread`, and `study-consistency`. `orchestrator.md` is not a role.

## Testing Decisions

A good test here asserts the external contract a reader of the prompts can see: which files exist, which paths each skill names, which dispatch steps each skill requires, and which version strings ship. It does not assert incidental wording.

One seam: extend `test/prompt-consistency.test.mjs`. The test already reads both skill files and pins exact phrases, so it is the highest existing seam and needs no new runtime module. Add these assertions:

- all six role files and `orchestrator.md` exist under `agents/`;
- every file under `agents/` opens with frontmatter that carries `name` and `description`, and the six role names match the role table;
- neither skill file contains `../study` or `../study-plus`;
- `study-plus` does not name a load of `study`;
- `study` names `lecture`, `figure`, `proofread`, and `.material/`;
- both skill descriptions carry `[v0.7.0]`;
- the overlay names the shared standard as the source of lecture-writing rules;
- the package whitelist includes `agents`;
- `.gitignore` includes `.material/`.

Keep the existing phrase tests for behavior this change does not touch. Update or delete only the tests that pin the old role names or paths.

Run `npm run check` after the change. The known `diagram.test.mjs` failure on a fresh Windows checkout with `core.autocrlf=true` is unrelated. Record it and do not fix it here.

Prior art: the existing prompt-consistency test reads skill files and pins phrases. The book test uses a temp workspace and runs the real builder.

## Out of Scope

- A plugin tool that spawns a role by name, YAML agent presets, or host registry changes. ADR 0008 records that a third-party bundle cannot insert preset rows.
- Changes to tracker formats, book assembly, the settings page, or the diagram skill.
- A consistency role in quick mode.
- Migrating existing Courses or moving `study/<course>/` files.
- Publishing a tag or an npm release. The release stops at the version bump, changelog, and ADR.
- Fixing the CRLF diagram test.

## Further Notes

The shared pool sits one level above the skill folders, so the path rule assumes both skills install from one package. That is the plugin's install shape. A single copied skill breaks, and both skill texts must state the assumption.

`.material/` is neither `.scratch/` (the issue tracker) nor `study/` (the tracker). The glossary must keep the three apart.

`lecture.md` serves two readers: the parent for Teach, and the dispatched role for a draft. Keep the role instructions in a marked section so the parent can stop at the contract.

The working tree already has uncommitted `GLOSSARY.md`, README, and `.scratch/` changes. Preserve them.

ADR 0027 records the six-role pipeline. ADR 0028 records this change and does not delete 0027.

The installed plugin is a directory junction to this repo, so a DSH restart is needed before the catalog shows the new version marker.
