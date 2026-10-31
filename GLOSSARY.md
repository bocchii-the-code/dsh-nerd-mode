# Study Plus

A dsh skill that runs a study session against a durable, dated record of what one learner has produced.

## Language

**study** (小课):
The no-grading guide. Teaches one concept or one task in steps, stops once at a fork, and keeps no learner record. It owns the teaching and lecture-writing standard. It writes lecture drafts when `study-plus` passes an approved graph and one destination per Concept. It may draw an SVG figure on its own when a picture helps.
_Avoid_: quick class, mini lesson, tutorial, study mode

**study-plus** (大课):
The recorded learning skill. Organizes one topic as a Book of Chapters and Sections, teaches and assesses one concept at a time, and keeps the learner model and saved teaching material. It follows the study writing standard before it teaches.
_Avoid_: study, lesson, mentor, tutor

**Nerd Mode**:
The switched-on state of one conversation. It sets teaching as the default posture and the guide as the default answer shape. It is neither a preset nor a skill. Toggled from the composer bar, or with `/nerd-mode on|off`.
_Avoid_: study mode (the former name), tutor mode, mode preset

**Recall Session / 课前回忆**:
A pre-teaching activity within a `study-plus` session. The learner answers one question about a recently taught relevant concept, then receives ungraded feedback and a brief recap. The answer is not evidence and does not change the learner model or session log.
_Avoid_: recall step, retrieval quiz

**Fork**:
A point in a guided explanation where more than one route changes the result. The guide stops, states the choice, and asks one question. No rubric, no grade.
_Avoid_: checkpoint, quiz, test

**Book**:
The chapter and section organization of one topic. It follows the learner's textbook when one is provided, and otherwise follows a proposed grouping. A Book can be rendered as one HTML page.
_Avoid_: course, syllabus, curriculum

**Chapter**:
A group of related Sections inside a Book. The source's chapter structure sets the grouping and order when the learner provides one.
_Avoid_: unit, module, block

**Section**:
The place of exactly one concept in a Book. Section order inside a Chapter is reading order. A Section is an organizing slot, not a lecture.
_Avoid_: lesson, file, page

**Book order**:
The reading order of Sections, chapter by chapter. It is independent of the order in which study-plus teaches.
_Avoid_: graph order

**Learning order**:
The order of the concept table, where every Concept follows its prerequisites. It supports a recommendation. It never restricts what the learner may select.
_Avoid_: book order, syllabus order, required path

**Concept**:
A named idea with a one-line definition and prerequisite links. It maps to exactly one Section, and learner state attaches to it.
_Avoid_: topic, subject, card, item

**Concept cycle**:
The recall, teaching, assessment, teach-back, and recording for one Concept. One conversation can contain more than one Concept cycle.
_Avoid_: session (when referring to one Concept's teaching and assessment)

**Concept graph**:
The set of concepts for one topic, their prerequisite links, and their Chapter and Section placement. It is also called the chapter graph when it carries that placement.
_Avoid_: syllabus, curriculum, outline

**Calibration** (开课校准):
The one-time question round for a new topic. It asks for the learning goal, the learner's prior exposure, and the concepts the learner already knows well enough to skip. It runs after graph approval and before any tracker file is written. It is not evidence and changes no learner state.
_Avoid_: onboarding, interview, survey

**Teaching level** (教学深度):
A self-reported pitch for one topic, with three values: `beginner`, `standard`, and `advanced`. It sets both step size and explanation detail. It says nothing about mastery, never changes a state, and never counts as evidence.
_Avoid_: learner level, proficiency, difficulty

**Teaching brief**:
The three `graph.md` lines passed verbatim to `study`: `Goal`, `Background`, and `Teaching level`. It is context for writing a lecture, not a record of what the learner knows.
_Avoid_: learner profile, learner model, settings

**Learner model**:
A durable record of what one learner has demonstrated, one state per concept, used to decide what to teach next.
_Avoid_: learner profile, memory, progress tracker

**Tracker**:
The working record for one topic: its concept graph, concept states, and Concept cycle log. study-plus owns it.
_Avoid_: database, progress file

**Evidence**:
A produced answer or a graded teach-back. Evidence is the only thing that changes what the learner model says the learner knows.
_Avoid_: signal, observation, impression

**Signal**:
Something the tutor infers from the conversation, such as confusion or a wrong mental model. A signal may trigger a check and never changes state on its own.
_Avoid_: evidence, assessment, score

**State**:
The status of one concept in the learner model, dated when evidence exists. The states are `new`, `in_process`, `shaky`, `fluent`, and `skipped`.
_Avoid_: score, level

**Correct**:
An answer whose conclusion holds and whose stated steps are each valid. The route may differ from the one the tutor expected.
_Avoid_: right, matching, expected

**Question slot**:
One planned unseen question in a `study-plus` assessment. Hints, re-asks, and similar questions belong to the same slot and do not increase the configured count.
_Avoid_: question attempt

**Miss**:
An answer whose idea is wrong. Only a miss counts against the record.
_Avoid_: mistake, error, slip

**Gap**:
Something missing from an answer that is otherwise right. The tutor names it and corrects it, and it never counts as a miss.

**Defer**:
The learner declines to answer a question, usually for time. It is neither evidence nor a miss, and the concept stays `in_process`.
_Avoid_: skip (that word belongs to a concept the learner dropped)

**Fluent**:
At least two-thirds of the configured unseen-question slots answered correctly, plus a graded teach-back, inside one session. With zero slots, a passed teach-back is sufficient. Says nothing about retention.
_Avoid_: mastered, verified, known, understood

**Shaky**:
A concept that has evidence of failure, or one that was fluent and then corrected.

**Skipped**:
A concept the learner dropped at graph approval, or later on their own word. No evidence, no date, never `fluent`. A lecture that depends on it opens with a recap.
_Avoid_: known, assumed, mastered, done

**in_process**:
A concept that was taught and received no verdict. It satisfies no prerequisite and is not evidence.
_Avoid_: in progress, in-progress, taught, unfinished

**Recommended concept**:
A Concept whose prerequisites are all `fluent` or `skipped` and which is itself neither `fluent` nor `skipped`. It is a suggestion, not a limit on what the learner may choose.
_Avoid_: ready, next topic, backlog

**Veto**:
The learner overriding the chosen concept. A run of vetoes is a signal that the learning order is wrong.

**Lecture draft**:
Complete teaching material prepared from an approved concept graph before a Concept cycle. It sits in the Concept's final lecture path, carries `status: draft` and the Concept number, and has no teaching date. It is not evidence that teaching or learning took place.
_Avoid_: Lecture, taught lecture

**Archive**:
The folder `lectures/archive/` inside a topic. It holds the lecture file of a Concept that a graph change removed. The HTML Book never includes it.
_Avoid_: trash, backup

**Lecture**:
The teaching explanation for one Concept during a Concept cycle. It is not a Book, a Chapter, a Section, or a file. A saved Markdown copy records the explanation, and that copy carries the teaching date.
_Avoid_: lesson, chapter, section, content dump

**Lecture library** (讲义库):
The read-only list of saved lecture copies in one workspace, grouped by topic. It exists to find teaching material. It is not a Book, not a Tracker, and not evidence that a Concept was taught.
_Avoid_: notes panel, docs browser, file manager

**Figure**:
One SVG image that shows one idea, used in a lesson or lecture.
_Avoid_: chart, picture

**Symbol definition** (符号定义):
The line directly above a display formula that gives each symbol the formula introduces a noun and a role. A symbol gets one definition, at the place the reader first meets it, and later formulas reuse it.
_Avoid_: notation, legend

**Symbol table** (符号表):
A table at the head of a lecture that lists only the symbols several formulas share. It is a lookup aid, not a definition.
_Avoid_: glossary, notation table
