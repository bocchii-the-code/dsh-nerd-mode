# Recall Session is on by default, and the skipped-prerequisite recap is unconditional

Status: accepted, 2026-11-20. Supersedes the recap coupling in [ADR 0013](0013-session-defaults-for-recall-and-questions.md).

Testing is the strongest measured technique in the teaching literature, and the setting shipped off. A learner who never opens Settings never gets the one activity that most improves retention. The default is now on.

The old switch controlled two acts: a retrieval question and the one-line recap of a skipped prerequisite. They have different costs. The question costs a turn and produces an answer. The recap costs one sentence and asks nothing. Coupling them meant that turning recall off also removed the only support for a prerequisite the learner never met. The recap is now unconditional, and the switch controls the question only.

Alternatives. Keeping the default off and recommending recall in the first session was rejected: the learner already agreed to tracked study, and the skill skips silently when no suitable concept exists. A second setting for the recap was rejected: one sentence does not deserve a toggle that every learner must understand. Inferring the recap from the learner's level was rejected: the level never changes the recap, and a skipped prerequisite is known from the graph alone.

Consequences. A tracked session may open with one extra question, and a learner who turns recall off still receives the recap. ADR 0013's sentence that "no recall" means no pre-teaching recap of any kind no longer holds.
