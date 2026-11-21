# Release 0.6.1: ADR, changelog, version markers

Status: resolved
Blocked by: 08

## Goal

Record the decision and ship the version bump that the spec asks for.

## Context

- Spec: `C:/Users/zhang/.dsh/dev-dsh/study-plus-dsh/.scratch/subagent-pipeline/spec.md`, §Further Notes and §Testing Decisions.
- ADR house style: `docs/adr/0026-draft-practice-with-reasoned-answers.md`. Read one more, such as `0024-publish-from-a-tag-with-trusted-publishing.md`.
- Changelog style: `CHANGELOG.md`, keep-a-changelog with `### Added`, `### Changed`, `### Fixed` and one line per change.
- Version marker rule: `AGENTS.md` §Skill versions, and `test/prompt-consistency.test.mjs`.

## Files

- `docs/adr/0027-preparation-runs-as-subagent-roles.md` (new)
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `skills/study/SKILL.md` (frontmatter description only)
- `skills/study-plus/SKILL.md` (frontmatter description only)

## Work

### ADR

Write `docs/adr/0027-preparation-runs-as-subagent-roles.md`. The spec asks for `0025`, but `0025` and `0026` are taken, so this one is `0027`. Say in one line that the number moved.

Content, about 200 words, in the style of the existing ADRs:

- Title: preparation runs as six subagent roles.
- Status: `accepted, 2026-11-20.`
- The problem: one context window carries research, graph building, drafting, figure drawing, and review, so quality falls as the Book grows.
- The decision: six role files, one shared header, and the parent owning the learner conversation and every tracker write. Name the six roles in one sentence.
- What the parent keeps: `graph.md`, `state.md`, and `log.md` writes, approval, calibration, teaching, questions, teach-back, grading.
- Alternatives rejected, one line each: keeping preparation in one lane (the reason in the spec), registering the roles as DSH presets (unverified), a separate fact-checker role (proofreading and research already cover it).
- Consequences: parallel drafts per Chapter, one `sources.md` per Course, figures drawn from written requests, and a serial fallback on a host with no subagent tool.

### Changelog

Add `## [0.6.1] - 2026-11-20` above `## [0.6.0]`, with:

- `### Added`: the six preparation roles and the shared header, `sources.md`, the figure request and the figure role, proofreading and the consistency review, the four fallbacks, the cost guards.
- `### Changed`: drafts no longer draw the chapter figure, they emit a figure request. The draft contract moved to `skills/study/references/draft.md`.

Keep each line short and factual. Do not claim a behaviour the prompt files do not state.

### Version

- `package.json` and the two `version` fields in `package-lock.json` become `0.6.1`.
- Both skill descriptions become `[v0.6.1] ` and keep the rest of the text unchanged.

## Acceptance

- The ADR exists, is numbered 0027, and follows the existing heading and status style.
- `CHANGELOG.md` gains the 0.6.1 section above 0.6.0.
- `node --test test/prompt-consistency.test.mjs` passes: the three version strings agree.
- `GLOSSARY.md` is unchanged. The four new terms are already written in the main working tree and must not be duplicated here.
- No other file changes.

## Answer

Resolved on `feat/preparation-pipeline` in `acd62aa`.

`docs/adr/0027-preparation-runs-as-subagent-roles.md`, the `## [0.6.1]` changelog section, `package.json` and both lockfile version fields, and both skill description markers. The ADR number moved from the spec's 0025 because 0025 and 0026 already exist. `GLOSSARY.md` is deliberately untouched: its four new terms already exist as uncommitted work in the main working tree, and touching the file would collide with it.
