# The opening question states each option's depth

Status: accepted, 2026-11-13. Refines [ADR 0018](0018-opening-question-offers-choices.md).

ADR 0018 fixed the labels, but a learner could not tell what each depth choice costs. "Understand the principles" and "get a rough overview" read alike, and the level table reads the goal beside the background, so no single option decides the lecture depth.

Now every goal and background option carries a one-clause description of the depth it tends toward, for example 偏全：按考点讲全，不逐句铺开. The description is fixed copy in `assets/section.md`, follows the learner's language, and stays within 20 characters in Chinese or about 6 words in English. It sits in the option's description field, and in the numbered text list it follows the label in parentheses. Path options and quiz options carry no description.

The wording stays a tendency ("偏快", "偏慢") because the level comes from both answers together. A description that promised `advanced` would contradict the level table whenever the background pulls the result down.

Alternatives. Putting the depth into the label was rejected: the card gets long and the label stops being scannable. A level name on each option was rejected: one level covers several options, so the clause would repeat. Letting the choices set the level was rejected in ADR 0018 and stays rejected.
