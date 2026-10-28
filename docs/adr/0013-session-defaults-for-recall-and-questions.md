# Recall Session and unseen questions follow profile defaults

Status: accepted, 2026-10-28. Implements [ADR 0012](0012-study-plus-defaults-in-host-settings.md).

`study-plus` hard-coded two teaching behaviors: the session always opened with a tutor recap, and assessment was always exactly three unseen short-answer questions. A learner could not turn the recap into an actual memory jog, skip the questions, or change the question count and form without editing prompt patches.

Three profile defaults now live in host settings. `recallSessionEnabled` replaces the tutor monologue with one retrieval question: the learner answers one question about a recently taught relevant concept, receives ungraded feedback and a brief recap, and nothing is written to the tracker or the log. The switch also controls the existing one-line recap of a skipped prerequisite, so "no recall" means no pre-teaching recap of any kind. `unseenQuestionCount` plans 0–10 unseen question slots; a slot is one planned question, and hints, re-asks, or similar questions stay inside their slot. `unseenQuestionType` asks short answers, four-option single-answer multiple choice, or a mix chosen independently at random per slot. The pass bar scales with the count: `ceil(2n/3)` correct slots plus a passed teach-back for n ≥ 1, and a passed teach-back alone at n = 0.

An explicit preference inside one `/study-plus` request overrides its saved default for that session and never rewrites the profile. Ordinary `/study` and non-teaching requests stay untouched.

Alternatives. A constant prompt string was rejected: editing it meant patch files by hand. A per-session picker was rejected: it re-asks on every invocation. Making the Recall Session graded was rejected: pre-teaching retrieval would then drift into evidence and start scoring old concepts on a cold start.
