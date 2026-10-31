# Ask once before the path

Status: accepted, 2026-10-31. Extends [ADR 0014](0014-teaching-level-in-the-topic-file.md).

A one-concept learning request in Nerd Mode went straight to `study`, so the learner met a lecture with no chance to say what they wanted to reach or what they already knew. Calibration existed only inside `study-plus` and only after graph approval, which is too late for a one-off answer. A request such as "I want to learn X" counted as a stated goal, so the level came from a guess.

Now a learning request with no explicit command gets one opening question before either skill loads. It asks for the goal, the prior exposure, and the path: one complete answer in this conversation, or tracked study with one concept per session. The answers choose the skill and travel with it as the teaching brief. A bare topic, or "I want to learn X", answers neither the goal nor the background. An explicit `/study` or `/study-plus` states the path, so it skips the opening question, and `/study-plus` still calibrates after graph approval. A tracked topic never re-asks an answered item: approval asks only the concepts to skip.

Alternatives. Asking after the graph was rejected: it decides the path too late and repeats a question the learner just answered. Asking on every request was rejected: an explicit command already states the path. Deriving the level from a bare topic was rejected: the model read "I want to learn X" as both a goal and a background, and taught at a level nobody chose.
