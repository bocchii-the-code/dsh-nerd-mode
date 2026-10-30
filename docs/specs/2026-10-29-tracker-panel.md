# Spec: Tracker status panel

## Problem Statement

A learner using tracked study keeps a Tracker on disk: a concept graph, a state table, and a cycle log. The only way to read it is to open the Markdown files or the generated Book page. The Book deliberately hides learner state, so it cannot answer the question that matters between lessons: how far am I, what did I just study, and what comes next. The learner has to reconstruct progress from `state.md` by hand.

## Solution

Add a read-only Study tab to the conversation view bar, beside Chat, Trajectory, Context, and the rest. It reads the Tracker of the current conversation's workspace and shows four things: a progress percentage, a strip with the previous, current, and next Section in Book order, the shaky Concepts, and the three most recent Concept cycles. Switching to the tab costs no navigation, and switching back to Chat loses nothing. The panel never writes, never starts a session, and needs no setup.

## User Stories

1. As a learner, I want a Study tab in the conversation view bar, so that I can check my progress without leaving the conversation.
2. As a learner, I want the tab to sit after the shipped view tabs, so that the familiar order does not move.
3. As a learner, I want the tab to read this conversation's workspace, so that it shows the book I am actually studying.
4. As a learner with more than one topic in that workspace, I want to switch topics, so that each Book has its own status view.
5. As a learner, I want one progress percentage for the Book, so that I can tell how much is left at a glance.
6. As a learner, I want skipped Concepts left out of the denominator, so that the percentage measures what I still intend to learn.
7. As a learner, I want the previous Section in reading order, so that I can place where I came from.
8. As a learner, I want the current Section, defined as the Concept with the most recent Evidence, so that the page matches what I just did.
9. As a learner, I want the next Section in Book order, so that I know where to continue reading.
10. As a learner, I want the next Section to skip Concepts that are already fluent or skipped, so that it never points at finished work.
11. As a learner, I want the shaky Concepts listed, so that I know what deserves a second pass.
12. As a learner, I want the shaky list ordered by the most recent Evidence, so that the freshest gap comes first.
13. As a learner, I want the three most recent Concept cycles with their dates and results, so that I can see the recent rhythm of my study.
14. As a learner in a workspace with no Tracker, I want a plain message naming the folder that was searched and the command that creates one, so that I am not stuck at an empty tab.
15. As a learner whose Tracker has no Evidence yet, I want the page to say so instead of showing a bare zero, so that a fresh Book does not look like a failure.
16. As a learner whose every Concept is skipped, I want a dash instead of a percentage, so that the page never divides by zero.
17. As a learner who has finished a Book, I want the next slot to say the Book is finished, so that I am not left guessing.
18. As a learner, I want the tab to be strictly read-only, so that the record stays trustworthy evidence of what I did.
19. As a learner whose files cannot be read, I want one line naming the failure, so that I can tell a permissions problem from a missing file.
20. As a learner in a narrow window, I want the three-part strip to stack, so that it stays readable when the conversation is narrow.
21. As a learner using a screen reader, I want the progress figure and the Section strip announced with their roles and labels, so that the page is usable without sight.
22. As a learner, I want the tab to reload when I return to it, so that a lesson I just finished is reflected without a refresh control.
23. As a learner, I want the page to keep working when one Concept row is malformed, so that one bad line cannot blank the whole view.

## Implementation Decisions

**Seat.** Register one entry in the conversation view list slot, identified as `study`, ordered after the shipped view tabs, labelled "Study". The shell builds the tab row from these entries and falls back to the entry id when a label is missing, so a plain string label needs no locale package. The entry is session-scoped: its inject factory receives the Session id, and the component renders inside the conversation view area. The panel owns no tab chrome, no page header, no top clearance, and no back control.

**Manifest.** No new client inject row is needed: the conversation package that declares the view slot is already injected. The host module and the configuration patch stay untouched.

**Data scope.** The workspace root is the current conversation's working directory, derived by the host from the Session. Because the tab is already bound to that Session, the panel makes no choice of its own. All reads name that Session id.

**Topic choice.** Within the workspace, list the `study` folder. When it holds one topic, show it. When it holds several, show the one whose state table changed most recently and offer a selector in the tab body listing the others.

**Read sequence.** List `study`, list the topic directory, then read `state.md`, `graph.md`, and `log.md`. Treat a missing file as an empty input rather than a fatal error. Treat a directory read through the file method as an expected error and use directory listing to probe instead. Read once when the tab body mounts, and again when the topic changes. No file watcher and no refresh control: the shell unmounts a view when another tab is selected, so returning to Study reads fresh.

**Parsing.** Parse the three Markdown shapes defined by the study-plus skill: the graph's topic header, optional chapter list, and concept table; the state table with its seven columns; and the log's repeated blocks. Parsing lives inside the client module, because the client loader resolves only platform modules and package rows, a relative require throws, and the bundle arrives as a classic script that cannot carry export statements. Be tolerant: ignore a row whose columns do not line up, count it, and report the count in one line. When the graph has no chapter or section columns, use chapter 1 and the row order as the section order. When the chapter list is absent, use the Book title or the topic name.

**Model.** One snapshot holds: topic slug and Book title, total Concepts, skipped count, fluent count, denominator, percentage, the Concept list ordered by chapter then section, the current Concept, the previous Concept, the next Concept, the shaky Concepts, the parsed cycle blocks, a malformed-row count, and a state of loading, ready, empty, or failed.

**Progress.** Denominator is every Concept whose State is not `skipped`. Numerator is every Concept whose State is `fluent`. Percentage is the numerator divided by the denominator, floored to an integer. A zero denominator yields no percentage. `in_process` counts toward the denominator and not the numerator.

**Ordering.** Book order is ascending chapter, then ascending section, with ties keeping the graph's row order. Current is the Concept with the latest dated Evidence. Previous is the Concept immediately before current in Book order. Next is the first Concept after current whose State is neither `fluent` nor `skipped`. With no current Concept, the next slot is the first Concept in Book order that is neither `fluent` nor `skipped`, and the previous slot is empty.

**Shaky list.** Every Concept whose State is `shaky`, ordered by most recent Evidence first, capped at five rows, with a closing count when more exist. Each row names the Concept and its chapter and section.

**Recent cycles.** The last three log blocks, newest first. Each shows the date and the Result line. When Result is absent, show the Concept name.

**Empty and failure states.**

| Situation | What the tab body shows |
|---|---|
| No `study` folder in this workspace | One line naming the folder it searched, plus the command that creates a Tracker |
| Topic with a graph but no state table | Zero percentage, "No evidence yet", and the graph-derived next Section |
| Every Concept skipped | A dash for progress, with one line saying every Concept is skipped |
| No dated Evidence anywhere | "No lesson recorded yet" in the current slot |
| Nothing left after current | "End of Book" in the next slot |
| Only skipped Concepts left after current | "Everything left is skipped" |
| Malformed rows | The panel renders what parsed, plus one line with the count |
| Read failure | One line naming the failure; keep the last good snapshot if one exists |
| Loading | A plain loading line, no skeleton of fake numbers |

**Copy.** English, matching the plugin's existing interface text. Progress reads "42% of the Book". The strip labels are Previous, Current, Next. Section identity reads chapter title, section number, Concept name.

**Layout.** One column inside the conversation view area, maximum width 720 pixels, matching the Settings section. Order: a header row with the Book title and the topic selector when needed, the progress block, the three-part strip, the shaky section, the recent cycles section. The strip is three rows on a narrow window and three columns otherwise. Use the existing theme alias variables for colour, border, and type; no new colour range. The progress figure uses a track and a fill, with the number also stated as text. The track is 8 pixels high with fully rounded ends and the colour `--dsw-alias-border-l3`. The fill uses `--dsw-alias-state-business-primary` and does not animate. A zero percentage keeps an empty track, so the bar is visible before the first lesson. When every Concept is skipped, the block shows no track.

**Accessibility.** The tab itself belongs to the shell's tab row and carries its own roving focus; the panel owns only the body, which is a region with an accessible name. The progress block exposes a progress bar role with its current value and its maximum, and repeats the value as text. The strip is a definition list with the three labels. Focus order follows the visual order.

## Testing Decisions

A good test here asserts what a learner can see at the tab boundary: the text, the roles, and the attribute values the panel depends on. It does not assert internal function names, call counts of private helpers, or a whole-tree snapshot. One behaviour per test, named after the learner-visible outcome.

There is one seam: the registered view entry. Mount the client module with a fake context, take its `conversation.view` registration, call the entry's inject factory with a fake Session id, render the component with the props the shell would supply, and assert the resulting tree. Fake inputs are the file remote, which returns fixture text for each requested path, and the session id.

Prior art: the existing client test mounts the same module against a fake context, then renders the Settings section and the composer pill and asserts visible strings and aria attributes. This spec extends that pattern with a fake file remote and a fixture per edge state.

Fixtures to cover: a full topic with mixed States across two chapters; a legacy graph with no chapter or section columns; a topic where every Concept is skipped; a topic with a graph and no state file; a state table with one malformed row; a missing `study` folder; and a read that fails.

The host module gains no behaviour and needs no test. The Book builder and the skill stay untouched, so their tests must keep passing unchanged.

## Out of Scope

- Writing, editing, or repairing Tracker files from the panel.
- Starting, resuming, or linking a study-plus session from the panel.
- A sidebar entry or a full main-area page. The tab is the only seat.
- Choosing which workspace or Session to read: the tab is bound to the current conversation.
- File watching or live refresh while a lesson runs.
- Review scheduling, streaks, reminders, or notifications.
- Localization of the panel.
- Multi-learner or synced Trackers.
- Changes to the Book page, which stays deliberately state-free.
- Changes to the Tracker file formats or the teaching flow.
- A host-side parsing or projection surface.

## Further Notes

- The view slot is session-scoped, and parsing runs on the client. That combination is what removed the hardest question in the first draft of this spec: there is no workspace to choose and no Session to pick, because the tab already belongs to one.
- Parsing cannot be shared with the Book builder. The client loader resolves platform modules and package rows only, a relative require throws, and the bundle arrives as a classic script with no export statements. A shared parser would need a build step, which this plugin does not have.
- The tab order must be checked once against a real build: the installed packages register Chat at order 0 and Trajectory at 10, and a newer build shows more tabs. Place Study after all of them.
- A blank Session hides the whole view area, so the panel never renders there. No empty state is needed for that case.
- The panel reads three files per mount. On a large Book the graph is the biggest of the three, and it is read once per mount, not per render.
