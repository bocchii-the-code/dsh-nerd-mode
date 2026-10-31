# 04 — Readers and changelog carry the Course word

Status: resolved
Blocked by: 01, 02, 03

## Question

Describe the Course in both READMEs and record the change in the entry the changelog test pins.

## Scope

Read the spec at `.scratch/course-folders/spec.md`, section **Docs**.

Edit only `README.md`, `README.zh.md`, and `CHANGELOG.md`. The glossary entry and `docs/adr/0016-course-folders.md` are already written.

1. `README.md`: replace every use of "topic" that names the record with Course. Replace the command examples so they show `/study-plus <course>`. Add one short paragraph on the Course question: asked once, skipped when one Course exists, and a second subject offers the current Course or a new one. Keep the existing sections where they are.
2. `README.zh.md`: the same changes in Chinese, matching the existing wording style. Do not translate term names that already appear in English, such as `study-plus`.
3. `CHANGELOG.md`: add lines under the existing `0.4.0` entry, in the `Changed` group. Do not add an `## [Unreleased]` heading: the changelog test rejects it, and it pins the newest entry to `package.json`.
4. Leave `NOTICE.md`, `docs/README.md`, the ADRs, and the historical specs under `docs/specs/` alone.

## Tests

- `node --test test/changelog.test.mjs` passes.
- `git grep -n -i 'topic' README.md README.zh.md` returns only ordinary uses of the word, if any.

## Acceptance

- A reader of `README.md` alone can say what a Course is and when they are asked for one.
- The changelog entry states the Course word and the picker.

## Answer

Resolved on `feat/course-folders`, commit a950385, merged at 6963116. The figure label was corrected in 3a3bc7a.

`README.md` and `README.zh.md` call the record a Course, show `/study-plus <course>`, and gain one paragraph on the Course question: asked once, skipped when the workspace holds one Course, and a second subject offers the current Course or a new one. The `/study` figure sentence now names both real paths instead of `diagrams/<topic>/`. `CHANGELOG.md` carries three Course lines under the existing `0.4.0` Changed group, and its Added line says Course too. No `Unreleased` heading.

`assets/calibration.svg` still drew "once per topic" in its visible text and its description, so both now say Course.

Verified: `node --test test/changelog.test.mjs` 4 pass, `node --test test/prompt-consistency.test.mjs` 6 pass, `git grep -i 'topic' README.md README.zh.md` returns nothing.
