# Fluent is a session claim, and no scheduler ships in v1

`fluent` means two correct unseen answers plus a graded teach-back in one session. It does not mean retained. There is no spaced-repetition scheduler, no decay timer, and no due queue in v1.

This is a deliberate deviation from the obvious design. A learner model without decay goes stale: a concept marked fluent in March still reads fluent in June. The mitigation is cheap and structural instead of algorithmic: every state row carries the date of its last evidence, and the tutor must state that date whenever it relies on the label.

Adding a scheduler later is expected and healthy. What must not change silently is the meaning of `fluent`: it is a claim about a session, and the date on the row is what keeps the claim honest. A future reader who adds an interval schedule should add a new state or a new column, not redefine this one.
