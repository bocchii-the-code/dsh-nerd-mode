# The opening question offers choices

Status: accepted, 2026-11-01. Refines [ADR 0015](0015-ask-once-before-the-path.md).

The opening question asked the learner to write the goal and the prior exposure as free text. The learner had to compose both answers on the spot, often in a hurry, and the result was vague. The path item already offered choices, so one round mixed two answer shapes.

Now all three items are single choices. The goal offers pass an exam, understand the principles, use it in a project or at work, and get a rough overview. The prior exposure offers never studied it, read introductory material, took a course or systematic training, and used it at work, ordered from least to most exposure, so the highest one that applies is the answer. The path offers one complete answer in this conversation, continue an existing Course, and start a new Course. The labels follow the learner's language, and the host's free input stays available for an answer outside the list. A host without a choice tool gets the same items as a numbered text list. The selected labels travel verbatim as the brief, and `study` never asks again for a goal or a background that a brief leaves out.

The choice sets are fixed. A model may not add or rewrite an option, because a shifting list cannot be checked and makes two sessions incomparable.

Alternatives. Multi-select for prior exposure was rejected: a learner who both read the topic and used it had no single answer, and the record needs one. Letting the model write the options was rejected: the same request would get different choices on different days. Letting the choices set the teaching level was rejected: the level table still reads the goal beside the background and the material, and a fixed lookup would turn a judgment into a guess.
