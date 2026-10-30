# 04 - Domain docs and READMEs

Status: ready-for-agent
Blocked by: none

## Question

Record the three new terms, the decision, and the learner-visible behavior in the repo's documentation.

## Scope

Read the spec at `.scratch/teaching-level/spec.md`, sections **Resolved domain**, **File format**, and **Changes by file**. Follow `GLOSSARY.md` and `docs/adr/0013-session-defaults-for-recall-and-questions.md` for shape. Edit only `GLOSSARY.md`, `docs/adr/0014-teaching-level-in-the-topic-file.md`, `README.md`, and `README.zh.md`.

1. `GLOSSARY.md`: add **Calibration** (开课校准), **Teaching level**, and **Teaching brief**, each with the definition and the `_Avoid_:` line the spec gives. Place them near the related teaching terms, not at the end of an unrelated block.
2. `docs/adr/0014-teaching-level-in-the-topic-file.md`: record the decision. State the problem, the decision, and the alternatives rejected. Reference ADR 0008 for the one-way dependency, ADR 0003 for `skipped` as a self-report, and ADR 0005 for teaching not being evidence. Status line: `accepted, 2026-10-30`. Keep the same length and voice as ADR 0013.
3. `README.md`: one short paragraph on the new behavior, placed in the `/study-plus` section near the first-session order block. Mention one calibration round, the three `graph.md` lines, and that a mid-topic change lasts for the session unless the learner says to keep it. Also add the new question to the first-session order block in place of the current skip line if that reads better.
4. `README.zh.md`: the same paragraph in Chinese, in the same place. The Chinese must read as native prose, not as a translation of English word order.

Do not add a settings row, a screenshot, or a table. Do not promise anything the spec does not state.

## Acceptance

- Three glossary entries with the avoid lines.
- ADR 0014 exists, is consistent with the spec, and links the earlier ADRs it depends on.
- Both READMEs carry one matching paragraph, in the same section, and the Chinese reads naturally.
- No other section is edited.

## Answer

Pending.
