# Steering follows the learner's target, not the graph order

The graph is numbered so prerequisites come first. The old rule taught the lowest-numbered ready concept, which covers the graph but ignores why the learner opened it. A learner who wanted the preconditioner had to walk every earlier concept.

A target fixes that. The learner names a concept, the tutor stores it in `plan.md`, and teaches its path: the target plus every prerequisite not yet fluent or skipped, in graph order. Concepts off the path wait. The number still orders the path, because the graph already puts prerequisites first.

The target persists because a path can take several sessions. A per-session target resets whenever the learner forgets to repeat it. Storing it in `graph.md` was rejected: a rebuild changes the concept numbers, and mixing a plan into the map makes both harder to read. `plan.md` keeps them apart and is cleared on a rebuild.

A reached target is not auto-advanced. The tutor clears the line, states the evidence date, and asks whether to go deeper, name a new target, or continue with the next ready concept. Auto-advancing would assume the next goal. Keeping the line would open every session with a target already met.

A veto on a path concept pauses the target for the session and takes the next ready concept. The path resumes next session. Clearing the target would throw away a plan the learner still holds.

Consequences. A path can stall on a prerequisite the learner avoids, and nothing forces progress. The graph order becomes an ordering device rather than a curriculum.
