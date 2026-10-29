# Spec: Tracker status panel

## Problem Statement

A learner using tracked study keeps a Tracker on disk: a concept graph, a state table, and a cycle log. The only way to read it is to open the Markdown files or the generated Book page. The Book deliberately hides learner state, so it cannot answer the question that matters between lessons: how far am I, what did I just study, and what comes next. The learner has to reconstruct progress from `state.md` by hand.

## Solution

Add a read-only Study page to the dsh web client. A Study row in the sidebar opens a full page that reads the Tracker for one topic and shows four things: a progress percentage, a strip with the previous, current, and next Section in Book order, the shaky Concepts, and the three most recent Concept cycles. The page never writes, never starts a session, and needs no setup: it finds the workspace and topic itself.

## User Stories

1. As a learner, I want a Study entry in the sidebar, so that I can reach my progress without leaving the app.
2. As a learner, I want the page to open on the topic I studied most recently, so that I do not have to pick it every time.
3. As a learner with more than one topic, I want to switch topics, so that each Book has its own status view.
4. As a learner, I want one progress percentage for the Book, so that I can tell how much is left at a glance.
5. As a learner, I want skipped Concepts left out of the denominator, so that the percentage measures what I still intend to learn.
6. As a learner, I want the previous Section in reading order, so that I can place where I came from.
7. As a learner, I want the current Section, defined as the Concept with the most recent Evidence, so that the page matches what I just did.
8. As a learner, I want the next Section in Book order, so that I know where to continue reading.
9. As a learner, I want the next Section to skip Concepts that are already fluent or skipped, so that it never points at finished work.
10. As a learner, I want the shaky Concepts listed, so that I know what deserves a second pass.
11. As a learner, I want the shaky list ordered by the most recent Evidence, so that the freshest gap comes first.
12. As a learner, I want the three most recent Concept cycles with their dates and results, so that I can see the recent rhythm of my study.
13. As a learner with no Tracker at all, I want a plain message naming what was missing and the command that creates one, so that I am not stuck at an empty page.
14. As a learner whose Tracker has no Evidence yet, I want the page to say so instead of showing a bare zero, so that a fresh Book does not look like a failure.
15. As a learner whose every Concept is skipped, I want a dash instead of a percentage, so that the page never divides by zero.
16. As a learner who has finished a Book, I want the next slot to say the Book is finished, so that I am not left guessing.
17. As a learner, I want the page to be strictly read-only, so that the record stays trustworthy evidence of what I did.
18. As a learner whose files cannot be read, I want one line naming the failure, so that I can tell a permissions problem from a missing file.
19. As a learner in a narrow window, I want the three-part strip to stack, so that it stays readable when the sidebar is open.
20. As a learner using a screen reader, I want the progress figure and the Section strip announced with their roles and labels, so that the page is usable without sight.
21. As a learner, I want the page to reload when I reopen it, so that a lesson I just finished is reflected without a refresh control.
22. As a learner, I want the page to keep working when one Concept row is malformed, so that one bad line cannot blank the whole view.

## Implementation Decisions

**Seats.** Register two client seats sharing one identifier, `nerd-mode-study`. The page fills the keyed main-area slot under that key. The sidebar row fills the sidebar panel list under the same identifier, at order 10, labelled "Study", with a 16-pixel book glyph reusing the composer pill's drawing. The row shows its own active state, so the page does not.

**Manifest.** Add the layout and sidebar client packages to the client inject list. Add the locale package only if an entry declares a locale namespace; this page uses literal strings and does not.

**Page props.** The page receives root props only: session list, workspace list, remote access, resources, and panel info. It receives no session id, so it must choose a Session itself. It pads its own top by the frame clearance token and owns its scroll container.

**Session choice.** Reads are Session-scoped: the file API names a Session, and the Host derives the workspace root from that Session's working directory. Pick the most recently updated Session whose workspace contains a `study` directory holding at least one topic. If none has one, use the most recently updated Session and let the empty state explain. Never borrow the conversation's Session.

**Data source.** Build one observable source while the plugin applies, expose it to the page through the entry's injected face as a hook, and start reading only when the first subscriber arrives. Dispose reads and late responses when the last subscriber leaves. The page owns no fetch and no mount effect. Each open of the page therefore reads fresh; there is no file watcher and no refresh control in this version.

**Read sequence.** For the chosen Session: list `study`, list the topic directory, then read `state.md`, `graph.md`, and `log.md`. Treat a missing file as an empty input rather than a fatal error. Treat a directory read through the file method as an expected error and use directory listing to probe instead.

**Parsing.** Parse the three Markdown shapes defined by the study-plus skill: the graph's topic header, optional chapter list, and concept table; the state table with its seven columns; and the log's repeated blocks. Parsing lives inside the client module, because the client loader resolves only platform modules and package rows, a relative require throws, and the bundle is loaded as a classic script that cannot carry export statements. Be tolerant: ignore a row whose columns do not line up, count it, and report the count in one line. When the graph has no chapter or section columns, use chapter 1 and the row order as the section order. When the chapter list is absent, use the Book title or the topic name.

**Model.** The source produces one snapshot with: topic slug and Book title, total Concepts, skipped count, fluent count, denominator, percentage, the Concept list ordered by chapter then section, the current Concept, the previous Concept, the next Concept, the shaky Concepts, the parsed cycle blocks, a malformed-row count, and a status of loading, ready, empty, or failed.

**Progress.** Denominator is every Concept whose State is not `skipped`. Numerator is every Concept whose State is `fluent`. Percentage is the numerator divided by the denominator, floored to an integer. A zero denominator yields no percentage. `in_process` counts toward the denominator and not the numerator.

**Ordering.** Book order is ascending chapter, then ascending section, with ties keeping the graph's row order. Current is the Concept with the latest dated Evidence. Previous is the Concept immediately before current in Book order. Next is the first Concept after current whose State is neither `fluent` nor `skipped`. With no current Concept, the next slot is the first Concept in Book order that is neither `fluent` nor `skipped`, and the previous slot is empty.

**Shaky list.** Every Concept whose State is `shaky`, ordered by most recent Evidence first, capped at five rows, with a closing count when more exist. Each row names the Concept and its chapter and section.

**Recent cycles.** The last three log blocks, newest first. Each shows the date and the Result line. When Result is absent, show the Concept name.

**Empty and failure states.**

| Situation | What the page shows |
|---|---|
| No Session with a `study` folder | One line naming the workspace it searched, plus the command that creates a Tracker |
| Topic with a graph but no state table | Zero percentage, "No evidence yet", and the graph-derived next Section |
| Every Concept skipped | A dash for progress, with one line saying every Concept is skipped |
| No dated Evidence anywhere | "No lesson recorded yet" in the current slot |
| Nothing left after current | "End of Book" in the next slot |
| Only skipped Concepts left after current | "Everything left is skipped" |
| Malformed rows | The page renders what parsed, plus one line with the count |
| Read failure | One line naming the failure; keep the last good snapshot if one exists |
| Loading | A plain loading line, no skeleton of fake numbers |

**Copy.** English, matching the plugin's existing interface text. Progress reads "42% of the Book". The strip labels are Previous, Current, Next. Section identity reads chapter title, section number, Concept name.

**Layout.** One column, maximum width 720 pixels, matching the Settings section. Order: header with the topic selector and Book title, the progress block, the three-part strip, the shaky section, the recent cycles section. The strip is three rows on a narrow window and three columns otherwise. Use the existing theme alias variables for colour, border, and type; no range of new colours. The progress figure uses a track and a fill, with the number also stated as text.

**Accessibility.** The page is a main landmark with an accessible name. The progress block exposes a progress bar role with its current value and its maximum, and repeats the value as text. The strip is a definition list with the three labels. The sidebar glyph is decorative; the row supplies the accessible name. Focus order follows the visual order.

## Testing Decisions

A good test here asserts what a learner can see at the page boundary: the text, the roles, and the attribute values the page depends on. It does not assert internal function names, call counts of private helpers, or a whole-tree snapshot. One behaviour per test, named after the learner-visible outcome.

There is one seam: the registered page. Mount the client module with a fake context, take its main-area registration, render the page component with the root props and injected face the renderer would supply, and assert the resulting tree. Fake inputs are the session list, the panel info, and the file remote, which returns fixture text for each requested path. This exercises parsing, progress, ordering, empty states, and failure handling through their only consumer.

Prior art: the existing client test mounts the same module against a fake context, then renders the Settings section and the composer pill and asserts visible strings and aria attributes. This spec extends that pattern with a fake file remote and a fixture per edge state.

Fixtures to cover: a full topic with mixed States across two chapters; a legacy graph with no chapter or section columns; a topic where every Concept is skipped; a topic with a graph and no state file; a state table with one malformed row; a missing `study` directory; and a read that fails.

The host module gains no behaviour and needs no test. The Book builder and the skill stay untouched, so their tests must keep passing unchanged.

## Out of Scope

- Writing, editing, or repairing Tracker files from the page.
- Starting, resuming, or linking a study-plus session from the page.
- File watching or live refresh while a lesson runs.
- Review scheduling, streaks, reminders, or notifications.
- Localization of the page.
- Multi-learner or synced Trackers.
- Changes to the Book page, which stays deliberately state-free.
- Changes to the Tracker file formats or the teaching flow.
- A host-side parsing or projection surface.

## Further Notes

- The Session-scoped file API is the constraint that shapes everything else. There is no call that reads a bare workspace path, so the page must choose a Session before it can read anything. That is why session choice is a page decision, not an implementation detail.
- Parsing cannot be shared with the Book builder. The client loader resolves platform modules and package rows only, a relative require throws, and the bundle arrives as a classic script with no export statements. A shared parser would need a build step, which this plugin does not have.
- The layout was decided in writing, not in a prototype. The first implementation pass should check the strip against a real topic at two window widths before the copy is finalised.
- The sidebar identifier is namespaced to avoid a silent takeover, because two registrations under one main-area key resolve to one page and the winner is not obvious for statically loaded plugins.
- The page reads three files per open. On a large Book the graph is the biggest of the three, and it is read once per open, not per render.
