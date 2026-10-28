# Spec: Nerd Mode Settings for `study-plus`

## Objective

Add a standalone Nerd Mode entry in the DSH Settings window. It lets users set profile-wide defaults for two `study-plus` behaviors: the pre-teaching Recall Session and the post-lecture unseen-question group. Settings apply to tracked `study-plus` sessions and do not change ordinary `study` or non-teaching requests.

## Resolved domain

- **Recall Session / 课前回忆** is a pre-teaching activity inside a `study-plus` session, not a separate learning session. When enabled, the learner answers one question about a recently taught relevant concept, then receives ungraded feedback and a brief recap. If no suitable concept exists, skip the activity. It adds no learner-model evidence and no session-log entry.
- One Recall Session setting controls both this activity and the existing one-line recap for a skipped prerequisite. When off, skip both. When on, keep the skipped-prerequisite recap when applicable.
- A **question slot** is one planned unseen question. Hints, re-asks, and similar questions stay within the current slot and do not increase the configured count. Keep existing follow-up behavior. Record original misses; a correct similar answer may resolve its slot as correct.
- A multiple-choice question has four options and one correct answer. Choosing the correct option is sufficient. Mixed mode chooses short-answer or multiple-choice independently at random for each slot. Do not add question-type details to the session log.
- With one or more slots, the pass threshold is `ceil(2 × slot count / 3)` correct slots plus a passed Teach-back. With zero slots, a passed Teach-back is sufficient to pass.

## Settings page

Add one root `settings.section` entry in the DSH Settings window. Do not add a main application sidebar panel or a Plugins-page tab.

Show two groups:

1. **Recall Session / 课前回忆**: an on/off switch, default off.
2. **Post-lecture questions**: an integer count from 0 to 10, default 3, and a question-type selector with `short-answer`, `multiple-choice`, and `mixed`, default `short-answer`.

Provide Save, Cancel, and one Restore defaults action. Restore defaults updates the draft; Save commits it. Cancel discards unsaved changes. A saved change applies to the next `study-plus` session, not a session already in progress. Save values to the active DSH profile so workspaces under that profile share them. Do not expose the full prompt `section` editor.

An explicit preference in a single `study-plus` request overrides the saved value for that session and does not update the profile.

## Runtime contract

Add three validated, volatile plugin settings:

- `recallSessionEnabled`: boolean, default `false`.
- `unseenQuestionCount`: integer, 0 through 10, default `3`.
- `unseenQuestionType`: `short-answer`, `multiple-choice`, or `mixed`, default `short-answer`.

Keep the existing non-empty `section` configuration unchanged and non-editable in this page. Read volatile settings at use time. Supply the values through the top-level Nerd Mode instruction, scoped to `study-plus` behavior. Do not change `skills/study/SKILL.md`, tracker file formats, or behavior for ordinary `study` and non-teaching requests.

## Project structure and style

- `lib/index.js`: validate and pass runtime settings into the prompt policy.
- `package.json` and `package-lock.json`: declare the host-provided Schemastery package as a peer dependency for linked plugin loading.
- `cordis.patch.yml`: define deployment defaults.
- `client.js`: register and render the Settings section with DSH settings and config-form services.
- `skills/study-plus/SKILL.md`: follow the configured Recall Session, question count, and question type.
- `GLOSSARY.md`: keep the resolved domain terms current.
- `test/`: add focused runtime and client tests using the existing Node test runner.

Keep the existing plain JavaScript and DSH slot patterns. Do not add a runtime package installation; declare `@deepseek-ai/schemastery` as a host peer dependency.

## Commands and verification

- Test: `npm test`
- Build and lint: no commands are declared in `package.json`.
- Manual DSH check: verify the Settings entry, draft/save/cancel/restore behavior, profile persistence, and live prompt updates in the desktop profile. Confirm that Recall and assessment preferences affect `study-plus` only.

Tests must cover config defaults and bounds, prompt behavior for active settings, Settings registration, form edits and save/cancel/restore, and save errors. Existing tests must continue to pass.

## Boundaries

- Always preserve `section` validation and existing `study` behavior.
- Always validate the question count and question type at the config boundary.
- Use the Schemastery instance provided by DSH. Do not install a second runtime copy.
- Do not log Recall Session answers or random mixed-mode choices.
- Do not change learner state or session logs because of Recall Session.
- Do not add prompt editing, per-workspace settings, extra settings groups, or dependencies.

## Success criteria

- The Settings window shows a standalone Nerd Mode section with exactly the two groups above.
- Defaults are off, 3, and `short-answer`; count values outside 0–10 and unsupported types cannot be saved.
- Save persists to the active profile, Cancel discards the draft, and Restore defaults resets all three values.
- Settings updates reach the runtime without a restart and affect the next applicable `study-plus` session.
- Recall is ungraded and unlogged. Count 0 skips unseen questions but allows Teach-back alone to pass. Other counts use the two-thirds threshold.
- Short-answer, four-option multiple-choice, and per-slot random mixed questions follow the stated contract.
- Existing session behavior remains intact outside the scoped settings.

## Open questions

None. Product scope and defaults were confirmed in the requirements discussion.
