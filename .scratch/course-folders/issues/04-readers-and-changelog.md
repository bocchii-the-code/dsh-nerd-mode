# 04 — Readers and changelog carry the Course word

Status: ready-for-agent
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
