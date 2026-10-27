# Evidence comes from produced work, not from reading the chat

The learner model changes state only when the learner produces something gradeable: an answer to an unseen question, or a teach-back. The tutor's inference from the conversation is a signal. It can trigger a check or pick the next probe, and it can never move a concept forward.

The alternative is the ordinary tutoring design: the model reads the conversation and decides the learner "seems to get it". ChatGPT Study Mode does this, and its most documented failure is telling a non-physicist they are near graduate level after four shallow questions. Confidence in the chat is not evidence of learning, and a model that grades its own impressions has no failure state.

This is expensive to reverse, because every later feature reads the state. If inference could write to it, the file would carry unverifiable claims with dates attached, and no reader could tell them apart from produced answers.
