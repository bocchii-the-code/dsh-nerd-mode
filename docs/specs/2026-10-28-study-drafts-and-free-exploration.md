# Lecture Drafts and Free Chapter Exploration

Status: settled 2026-10-28, amending the [v3 study specification](2026-10-28-study-plus-v3.md).

## Problem Statement

Learners wait between concepts while each teaching explanation is prepared. The persistent `plan.md` target and prerequisite path also make it harder to explore a Book in the learner's chosen order. Learners need prepared material and direct control over which Chapter or Concept to study, without weakening the per-Concept learner record.

## Solution

After the learner approves a concept graph and identifies any Concepts to skip, `/study-plus` passes the approved graph and relevant material to `/study`. `/study` prepares a complete lecture draft for every Concept, including skipped Concepts. Drafts do not count as teaching or change the learner model.

Drafts use the final lecture location and carry `status: draft`, a `concept` number, and no teaching date. During a Concept cycle, `/study` revises the draft for the learner and current material, then saves it as the dated Lecture. The HTML Book updates automatically and labels drafts separately from Lectures.

Remove `plan.md`, the persistent Target, and the mandatory prerequisite Path from the active model. A learner can choose any Chapter or Concept. Prerequisites remain useful for explanation and non-binding recommendations. A Chapter selection continues in Book order, one Concept cycle at a time.

## User Stories

1. As a learner, I want complete drafts for all Concepts after I approve a graph, so that lesson transitions take less time.
2. As a learner, I want the approval prompt to say that approval starts draft generation, so that I know which files the decision creates.
3. As a learner, I want drafts for skipped Concepts, so that I can explore them later without preparing them from scratch.
4. As a learner, I want a draft to include the teaching explanation and useful examples but no assessment questions, answers, or grading criteria, so that actual assessment questions remain unseen.
5. As a learner, I want draft generation to leave my Concept states and log unchanged, so that preparation does not look like learning.
6. As a learner, I want draft frontmatter to omit a teaching date, so that preparation does not imply that a Concept cycle occurred.
7. As a learner, I want `/study` to receive the approved graph and an explicit lecture destination, so that it can write drafts without reading tracker files.
8. As a learner, I want draft generation to work by Chapter in parallel when subagents are available, so that large graphs finish sooner.
9. As a learner, I want completed drafts to remain intact if generation stops partway, so that a later run can fill only missing drafts.
10. As a learner, I want the selected Concept's missing draft written before teaching starts, so that incomplete batch generation does not block my choice.
11. As a learner, I want existing dated Lectures and manual edits preserved, so that draft preparation does not overwrite work I already did.
12. As a learner, I want direct access to any Concept, including one with incomplete prerequisites, so that I can follow curiosity or a Chapter's reading order.
13. As a learner, I want prerequisite information and one recommended Concept without a forced path, so that I can make an informed choice without losing control.
14. As a learner, I want to choose a Chapter and continue through its Sections in Book order, so that I can read a topic as a book.
15. As a learner, I want each Concept cycle to keep its own teaching, assessment, state update, and log entry, so that studying several Concepts in one conversation does not merge their results.
16. As a learner, I want an interrupted Concept cycle to resume without a persistent target file, so that I can choose a different Chapter in a later conversation.
17. As a learner, I want to review fluent Concepts and restart skipped Concepts when I select them, so that the learner record does not prevent exploration.
18. As a learner, I want an HTML Book to show which content is a draft and which content was taught, so that I can read ahead without mistaking preparation for learning.
19. As a learner, I want the HTML Book to update after draft generation, a saved Lecture, or a graph rebuild, so that it reflects current materials.
20. As a learner, I want every replacement of an existing HTML Book to save the previous file as `.bak`, so that I keep a recovery copy.
21. As a learner, I want Book generation failure to leave the previous Book intact and not stop learning, so that a rendering problem does not block a Concept cycle.
22. As a learner, I want obsolete lecture files moved to an archive when a graph removes their Concepts, so that active books stay clean while old work remains available.
23. As a learner, I want changed Concept names mapped explicitly during graph approval when I want to preserve their state and material, so that similar names do not cause an incorrect migration.
24. As a learner, I want the old `plan.md` file left in place but ignored, so that this change does not delete my data.

## Acceptance Criteria

- Graph approval clearly states that all Concepts, including skipped Concepts, will receive drafts after the skip choice.
- Draft frontmatter has `status: draft` and the graph's Concept number. It has no teaching date.
- Draft generation does not change `state.md` or append to `log.md`.
- A draft contains teaching material and examples, not the unseen assessment set or its grading criteria.
- `/study` only reads and writes the specific lecture paths passed to it. It never reads or writes the graph, learner state, cycle log, or legacy plan file.
- Drafts are assigned to non-overlapping Chapter work when subagents are available. The main agent checks file paths, frontmatter, Concept coverage, prerequisites, supplied material, and clear cross-Chapter contradictions. It writes by Chapter if subagents are unavailable.
- A valid existing draft is preserved on retry. A valid dated Lecture is not replaced by a draft. An occupied or unrecognized target is reported for user resolution, not overwritten.
- Partial batch completion preserves completed drafts, updates the Book from available materials, reports missing drafts, and allows the learner to continue. A missing draft for the selected Concept is written before that Concept is taught.
- During actual teaching, the same file is revised for the current learner and material, gets the teaching date, and no longer has `status: draft`.
- The learner may select any Concept. A prerequisite may be explained or recommended, but it does not redirect or block the selection. Selecting a `skipped` Concept changes it to `in_process` only when teaching starts.
- A Chapter selection resumes an `in_process` Concept in that Chapter. If more than one exists, the learner chooses which to resume. Otherwise, it selects the earliest Book-order Concept that is neither fluent nor skipped. If none exists, it offers review or another choice without starting automatically.
- After each completed Concept cycle, the learner may continue the Chapter, choose another Chapter or Concept, or stop. Each completed cycle gets a separate log entry, including when several cycles share a date. An interrupted cycle remains `in_process` and does not receive a completed-cycle log entry.
- Explicitly selecting a skipped Concept starts it again when teaching begins. Selecting a fluent Concept is allowed for review.
- The persistent Target and Path concepts no longer drive selection. A non-binding Recommended concept requires all prerequisites to be fluent or skipped, while the Concept itself is neither fluent nor skipped.
- Existing `plan.md` files remain untouched and are not read or written by the new flow.
- HTML Book generation includes drafts and dated Lectures in Chapter and Section order, labels their content status, and never displays learner model states.
- The Book updates after a complete or partial draft batch, after a saved Lecture, and after a graph rebuild. An update backs up an existing Book to `book.html.bak` before replacement, replacing the older backup. A failed build leaves the current Book intact and does not block learning.
- Removing a Concept from a graph moves its existing lecture file to the archive. A rename preserves state and material only when the learner confirms an explicit mapping. Changed definitions or prerequisites identify affected drafts during graph approval and ask whether to keep or rewrite them.

## Implementation Decisions

- `/study-plus` remains the owner of graph approval, Concept states, and cycle logs. `/study` owns teaching content and lecture-writing standards.
- The upper layer passes the approved graph, necessary supplied material, and per-file destinations to `/study`. Direct `/study` remains independent and does not search for or read a graph.
- Store drafts at the same destinations as Lectures. Distinguish them with `status: draft` and the absence of a teaching date. Convert them to dated Lectures during actual teaching.
- Generate work by Chapter and keep each agent's file set disjoint. The coordinating agent validates results and handles missing work.
- Remove the active Target and Path behavior. Keep Book order and prerequisite order as separate concepts. Prerequisites inform optional advice but never restrict a learner's selection.
- Define a Concept cycle as recall, teaching, assessment, teach-back, and recording for one Concept. Write one log entry after a completed cycle. Keep the existing per-Concept state model.
- Treat an explicitly selected skipped Concept as a restart by changing it to `in_process` only when teaching starts. Allow fluent Concepts to be reviewed without treating draft generation as evidence.
- Update the existing Book builder to parse draft and dated lecture metadata, label content status, exclude archived files, and retain its Chapter and Section ordering.
- Back up the current Book before every automatic replacement. A build failure must leave the current output untouched.
- On graph changes, preserve valid dated Lectures and drafts for Concepts that remain. Ask about affected draft content, require explicit mappings for renamed Concepts, and archive removed Concepts' material without deleting it.
- Retain legacy plan files as inert user data. Do not migrate or delete their contents.

## Testing Decisions

- Tests must check observable files, parsed Book content, output safety, and learner-visible selection behavior. They must not depend on internal helper names or a specific implementation layout.
- Extend the existing Node test suite for draft and dated-Lecture parsing, draft labels and ordering, archived-file exclusion, backup replacement, failure preservation, and graph migration outcomes.
- Extend the existing Book builder tests, which already cover graph parsing, Chapter and Section ordering, missing lectures, orphans, duplicate mappings, unsafe paths, and rendered output.
- Use an isolated workspace for end-to-end checks of draft creation, interrupted generation recovery, free Concept selection, Chapter continuation, state and log updates, and removed-Concept archiving.
- Validate the skill handoff and subagent behavior through an actual `/study-plus` run. The repository has no automated conversation harness for these prompt-level interactions.

## Out of Scope

- Deleting or automatically migrating existing `plan.md` files.
- Changing the Nerd Mode switch, its client UI, or its session projection.
- Changing assessment criteria or treating generated drafts as evidence.
- Adding a spaced-repetition schedule, a multi-learner model, or persisted Chapter selection.
- Displaying learner states in the HTML Book.
- Automatically researching each Concept during draft generation. Use supplied material and the approved graph by default, and verify important or uncertain facts when needed.
- Printing all generated drafts in chat. Report the result and paths; the learner can request a draft by name.

## Further Notes

- This feature changes the current behavior described in the v3 study specification. Update the skill instructions, live prompt overlay, Book builder and tests, user-facing documentation, and the related Chapter and Section decision record together.
- The project glossary now defines `Lecture draft`, `Concept cycle`, and `Recommended concept` for this model.
- The testing plan uses two seams: automated file and Book behavior tests, plus isolated end-to-end workflow checks. Prompt handoff and subagent orchestration require an actual agent run.
