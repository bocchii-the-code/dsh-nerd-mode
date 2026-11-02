# When to use teach instead of study-plus

Type: grilling
Status: resolved
Blocked by:

## Question

Both `skills/teach` and `skills/study-plus` keep a dated learning record for one learner. Which one applies when?

Evidence, corrected after reading both skills:

- A rule already exists. `docs/specs/2026-10-27-study-plus-v2.md` says: "`teach` stays: it is invoked explicitly as `/teach` and does not blend." That spec is historical, and no learner-facing doc repeats it.
- The README's "Skills included" section lists `teach` as "a dated teaching workspace, by Matt Pocock". It says what teach is, never when to choose it over `study-plus`.
- The two skills are different in kind, not just in name:
  - `teach` builds a workspace: `MISSION.md`, `RESOURCES.md`, `NOTES.md`, `lessons/*.html`, `reference/*.html`, `assets/`, and `learning-records/*.md`. Its lessons are interactive HTML with quizzes, built around a mission, a zone of proximal development, and a real-world community.
  - `study-plus` builds a Course: a concept graph, per-concept states, a cycle log, Markdown lectures, graded checks, and an HTML Book.
- `teach` sets `disable-model-invocation: true`, so it runs only when the learner types it. Both learning skills stay model-invocable.
- The two record formats are separate. `teach` uses numbered `learning-records/0001-slug.md`, one paragraph each. `study-plus` uses `state.md` plus a dated `log.md`.

So the open question is narrower than it first looked: does the existing rule stand, does it need saying where a learner will see it, and do the two record formats stay separate?

## Answer

`teach` is removed from the package. Its rule is not restated anywhere, because there is nothing left to choose between.

What changed:

- `skills/teach/` deleted, including its four format files and `agents/openai.yaml`.
- The `teach` line is gone from the skills list in `README.md` and `README.zh.md`.
- `NOTICE.md` keeps the Matt Pocock row for `writing-beats` and keeps his copyright line. Only the `teach` name left the table.
- `skills/diagram/SKILL.md` no longer carries its `/teach` workspace special case. That rule pointed at a skill the package no longer ships.
- `docs/specs/2026-10-27-study-plus-v2.md` keeps its original sentence and gains one line marking it superseded.
- `package.json` moves to 0.4.4. `CHANGELOG.md` gains a `Removed` section. `test/changelog.test.mjs` now accepts `Removed` as a change group.

Verification: 109 tests pass, ESLint is clean, and `npm pack --dry-run` reports version 0.4.4 with seven skill folders and no `teach` file.

Two things this settles on the way past:

- **Records.** The question of two dated record formats disappears. `study-plus` keeps the only one: `state.md` plus the dated `log.md`.
- **Existing workspaces.** A learner who already ran `/teach` keeps `MISSION.md`, `lessons/`, `reference/`, `learning-records/`, and `assets/` where they are. Those files live in the learner's directory, and the package never owned them.

