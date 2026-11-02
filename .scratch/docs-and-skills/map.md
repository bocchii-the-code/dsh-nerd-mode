# Map: docs and skills alignment

## Destination

A list of improvement decisions: every promise in the docs matches what the code does, and the two learning skills have a stated division of labour. Decisions rank by learner experience first.

## Notes

- Tracker operations: `docs/agents/issue-tracker.md` (Wayfinding operations). Domain terms: `GLOSSARY.md`.
- Priority order for any decision: learner experience, then maintainability, then release reliability.
- One ticket per session, except `research`. Claim a ticket by writing `Status: claimed` before any work.
- A resolution appends the answer under `## Answer`, sets `Status: resolved`, and adds one line to Decisions so far below.
- Repo state at charting: 109 tests pass, lint clean, working tree clean, all 12 earlier tickets resolved.
- Already ruled out: interface and visual changes, skill or command renames.

## Decisions so far

<!-- one line per resolved ticket: name, gist, link -->

- [Lectures list scope](issues/01-lectures-list-scope.md): the Lectures tab lists the selected Course only. "Lecture library" means one Course's copies, so the glossary changed and the code did not.
- [Study tab documentation coverage](issues/02-study-tab-docs.md): the Study tab gets one feature bullet in both READMEs and no glossary term, because it is a view of the Tracker.
- [When to use teach instead of study-plus](issues/03-teach-vs-study-plus.md): `teach` is removed from the package in 0.4.4. There is nothing left to choose between, and `study-plus` keeps the only record format.
- [Four bundled skills unrelated to teaching](issues/04-unrelated-bundled-skills.md): all seven skills stay and none changes behaviour. The READMEs split them into Teaching and General tools.

## Not yet specified

- The boundary between the two READMEs and `GLOSSARY.md`. Churn suggests overlap: the main README changed 23 times, its Chinese pair 19 times, the glossary 13 times.
- How the two READMEs stay in sync once wording decisions land. Translation discipline is undecided.

## Out of scope

- Interface and visual work: `client.js` layout, the composer pill, panel styling.
- Renaming skills or commands. `study`, `study-plus`, and `nerd-mode` keep their names.
- Test coverage gaps: the `/nerd-mode` command branch (`lib/index.js:201-222`) and `book-client.js` behaviour.
- Product gaps: review scheduling, automated lecture quality checks.
- Housekeeping: `.archify/` ignore rules, the stale root `dsh-nerd-mode-0.4.0.tgz`, stale numbers in `.scratch/resume-entries.md`.
