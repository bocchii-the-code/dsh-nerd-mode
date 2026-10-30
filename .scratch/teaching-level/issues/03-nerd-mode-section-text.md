# 03 - Nerd Mode section text

Status: ready-for-agent
Blocked by: 02

## Question

Add the calibration, mapping, and brief-passing rules to the `section` text in `cordis.patch.yml`, so a plain Nerd Mode conversation carries them too.

## Scope

Read the spec at `.scratch/teaching-level/spec.md`, sections **Behavior** and **Changes by file**. Read the finished `skills/study-plus/SKILL.md` (ticket 02) and match its terms. Edit only `cordis.patch.yml`.

1. Extend the `section` text with these rules, in the same order the skill states them:
   - calibration runs once per new topic, after graph approval and before any tracker file is written, as one `question` call with three items;
   - the level mapping table, including the adjacent-level escape with a one-line reason;
   - the three brief lines are read from `graph.md` and passed verbatim to `study`;
   - a missing `Teaching level` line means `standard`, and an existing topic is never asked for calibration;
   - a mid-topic change lasts for the session only, and only an explicit "from now on" rewrites the `Teaching level` line.
2. Keep this short. The section text is a routing and precedence layer, not a copy of the skill.
3. Keep every existing routing rule, the one-way dependency statement, and the "Do not let `study` read or write tracker files" rule unchanged.
4. Add no settings key, no new plugin id, and no change to the YAML shape.

## Acceptance

- The section text names calibration, the three levels, and the verbatim brief handoff.
- The existing routing paragraph and precedence sentence are unchanged.
- `node -e "require('js-yaml')"` is not required. Validate by eye against the surrounding style, and run `npm test` unchanged.
- Terms match `skills/study-plus/SKILL.md` and `GLOSSARY.md`.

## Answer

Pending.
