# A draft carries ungraded practice, and graded items stay unseen

Status: accepted, 2026-11-20. Amends [ADR 0011](0011-drafts-and-free-selection.md).

ADR 0011 kept every question and answer out of a draft, because a learner who reads the graded items destroys the evidence. That rule is right for graded items and wrong for a textbook. A book without exercises cannot teach a procedure, and a reader cannot check a reading that offers nothing to attempt.

A draft now ends with two to four exercises, each with a reasoned answer, marked ungraded. They never enter `state.md` or `log.md`, and they are never reused as a graded slot. The tracked cycle keeps its own unseen questions, so the evidence stays clean.

Alternatives. Keeping every exercise out of drafts was rejected: it makes the Book unusable without a session. Reusing draft exercises as graded slots was rejected: the answers are printed on the page. A separate exercise file per Course was rejected: it adds a fifth tracker file for content that already belongs to the draft.

Consequences. Drafts are longer, a reader can self-check without a session, and the draft contract now mentions answers after ADR 0011 removed them. The pass bar and the evidence rules do not change.
