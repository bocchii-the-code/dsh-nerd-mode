# Study Plus

A dsh skill that runs a study session against a durable, dated record of what one learner has produced.

## Language

**study** (小课):
The guide skill. Teaches one concept or one task by guided steps, stops at a fork, and writes no record. Invoked as `/study`, or chosen by the model while Nerd Mode is on.
_Avoid_: quick class, mini lesson, tutorial, study mode

**study-plus** (大课):
The recorded session skill: five-step spine, concept graph, evidence log. Invoked as `/study-plus`. Always writes the four files.
_Avoid_: study, lesson, mentor, tutor

**Nerd Mode**:
The switched-on state of one conversation. It sets teaching as the default posture and the guide as the default answer shape. It is neither a preset nor a skill. Toggled from the composer bar, or with `/nerd-mode on|off`.
_Avoid_: study mode (the former name), tutor mode, mode preset

**Fork**:
A point in a guided explanation where more than one route changes the result. The guide stops, states the choice, and asks one question. No rubric, no grade.
_Avoid_: checkpoint, quiz, test

**Concept**:
A named idea with a one-line definition and prerequisite links. The unit that learner state attaches to.
_Avoid_: topic, subject, card, item

**Concept graph**:
The set of concepts for one topic, plus the prerequisite links between them.
_Avoid_: syllabus, curriculum, outline

**Learner model**:
A durable record of what one learner has demonstrated, used to decide what to teach next.
_Avoid_: learner profile, memory, progress tracker

**Evidence**:
A produced answer or a graded teach-back. Evidence is the only thing that changes what the learner model says the learner knows.
_Avoid_: signal, observation, impression

**Signal**:
Something the tutor infers from the conversation, such as confusion or a wrong mental model. A signal may trigger a check and never changes state on its own.
_Avoid_: evidence, assessment, score

**State**:
One row per concept in `state.md`: `new`, `shaky`, `fluent`, `skipped`, or `in_process`, with the date of the last evidence when there is one.

**Correct**:
An answer whose conclusion holds and whose stated steps are each valid. The route may differ from the one the tutor expected.
_Avoid_: right, matching, expected

**Miss**:
An answer whose idea is wrong. Only a miss counts against the record.
_Avoid_: mistake, error, slip

**Gap**:
Something missing from an answer that is otherwise right. The tutor names it and corrects it, and it never counts as a miss.

**Defer**:
The learner declines to answer a question, usually for time. Recorded in the log with the reason. It is neither evidence nor a miss, and the concept stays `in_process`.
_Avoid_: skip (that word belongs to a concept the learner dropped)

**Fluent**:
Two correct answers to unseen questions plus a graded teach-back, inside one session. Says nothing about retention.
_Avoid_: mastered, verified, known, understood

**Shaky**:
A concept that has evidence of failure, or one that was fluent and then corrected.

**Skipped**:
A concept the learner dropped at graph approval, or later on their own word. No evidence, no date, never `fluent`. A lesson that depends on it opens with a recap.
_Avoid_: known, assumed, mastered, done

**in_process**:
A concept the tutor taught and no verdict followed. Written when teaching starts, cleared by the next verdict. No date, no passes, never evidence, and it satisfies no prerequisite.
_Avoid_: in progress, in-progress, taught, unfinished

**Ready**:
A concept whose prerequisites are all `fluent` or `skipped` and which is itself neither fluent nor skipped. It can be taught now.
_Avoid_: next topic, backlog

**Target**:
The concept the learner wants to reach, stored in `plan.md`. One at a time. Distinct from the goal line, which says why the topic matters.
_Avoid_: goal, destination, objective

**Path**:
The target plus every prerequisite that is not yet `fluent` or `skipped`, in graph order. Steering follows the path while a target is set.
_Avoid_: route, syllabus

**Veto**:
The learner overriding the chosen concept. Recorded, because a run of vetoes is a signal that the graph's order is wrong.

**Lecture**:
The written explanation inside the Teach step. Numbered headings named after their content, no length cap, delivered as one message.
_Avoid_: lesson, content, material

**Figure**:
One SVG file under `study/<slug>/diagrams/`, referenced by a relative path. One idea per figure.
_Avoid_: chart, picture
