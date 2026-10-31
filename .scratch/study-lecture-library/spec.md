# Spec: Lecture library panel

Status: resolved

## Problem Statement

A learner who finishes a Concept cycle gets a saved lecture file under `study/<topic>/lectures/`. The only way to read that file again is the Files panel, which shows a raw directory tree with no idea what a lecture is, or the generated Book, which hides drafts and archived material. The learner cannot see what teaching material already exists, cannot tell a draft from a taught Lecture, and cannot find the lecture about one Concept without knowing its folder and number.

## Solution

Add a Lectures panel to the dock. The panel opens from a card on the dock's Start page and lists every saved lecture in the current workspace, grouped by topic. Each entry shows its Concept number, its title, and whether it is a draft, a taught Lecture, or archived. Picking an entry opens that file in the dock's document preview, so the learner reads it with the host's own Markdown rendering. The panel is read-only and needs no setup.

## User Stories

1. As a learner, I want a Lectures card on the dock Start page, so that I can find my teaching material from the same place as the other tools.
2. As a learner, I want the card to open a page inside the dock, so that I do not lose my conversation.
3. As a learner, I want the panel to read this conversation's workspace, so that it lists the topics I am actually studying.
4. As a learner with more than one topic, I want the topics grouped and named, so that I can tell two Books apart.
5. As a learner, I want each topic's lectures ordered by Concept number, so that the list follows the learning order.
6. As a learner, I want each entry to show the Concept number and the lecture title, so that I can pick one without opening it.
7. As a learner, I want a draft marked as a draft, so that I do not mistake prepared material for a lesson I already had.
8. As a learner, I want a taught Lecture marked with its teaching date, so that I can see when I covered it.
9. As a learner, I want archived lectures folded away under their topic, so that they do not clutter the list.
10. As a learner, I want to expand the archived group, so that I can still read a lecture whose Concept left the graph.
11. As a learner, I want picking an entry to open the file in the dock's document preview, so that the lecture renders with headings, formulas, and figures.
12. As a learner, I want the preview to open beside my current tab, so that I can move between the list and the lecture.
13. As a learner in a workspace with no `study/` folder, I want a plain message naming the folder that was searched and the command that creates one, so that I am not stuck at an empty page.
14. As a learner whose topic has no saved lectures yet, I want that topic to say so, so that an empty topic does not look broken.
15. As a learner whose lecture file cannot be read, I want one line naming the failure, so that I can tell a permissions problem from a missing file.
16. As a learner, I want one malformed lecture file to stay in the list without its marks, so that one bad file cannot blank the page.
17. As a learner, I want the panel to reread the folder when I open it, so that a lecture I just finished appears without a refresh control.
18. As a learner, I want the panel to stay read-only, so that browsing cannot damage my record.
19. As a learner in a narrow dock, I want titles to wrap and the list to stay one column, so that the page stays readable.
20. As a learner using a screen reader, I want the panel to name itself and announce each entry with its number, title, and state, so that the list is usable without a pointer.
21. As a learner using a keyboard, I want to move through entries and open one with Enter or Space, so that I never need a mouse.
22. As a learner who opens the panel twice, I want the same single page, so that repeated clicks do not stack duplicate tabs.
23. As a learner, I want the Book page and the tracker files left out of the list, so that the panel shows teaching material only.

## Implementation Decisions

**Seat.** The panel is a dock page, not a left-rail icon and not a conversation view tab. Register one tab type through the dock's tab registry, with the kind `lectures` and a guide entry that puts a card on the Start page. Register the page body in the keyed dock pane slot under the same id. The registration waits for the registry through the plugin's service injection, so a host without the dock simply shows nothing. The tab type is single-instance, so opening it again focuses the existing tab.

**Why not the left rail.** The left rail takes whole-column panels with no Start page and no card list. The screenshot that motivated this feature shows the dock's guide page, not the rail, so the dock is the correct surface.

**Data scope.** The panel reads the workspace of the conversation visible in the window. It takes that session from the same session service the dock's Context page uses, and it never borrows a session from a conversation slot. Every read names that session.

**Reads.** All reads go through the workspace file remote, so the browser half needs no Node file access. The panel lists `study/`, keeps directories as topics, then lists `study/<topic>/lectures/` and `study/<topic>/lectures/archive/`. It reads each lecture file once and parses only its leading frontmatter block. A missing `study/` folder or a missing `lectures/` folder is an empty result, not a failure. Any other read error becomes one visible line.

**Entry shape.** An entry carries the Concept number from the filename prefix, the topic slug, the title from the first level-one heading, the frontmatter `concept` value when present, and one state: draft when the frontmatter says `status: draft`, taught when the frontmatter carries a date, archived when the file sits in the archive folder. A file with unparsable frontmatter keeps its number and title and shows no state. The title falls back to the filename slug when the file has no heading.

**Ordering.** Topics sort by name. Lectures sort by Concept number, ascending. Archived lectures keep their own order inside the folded group. A lecture never appears twice.

**Reading.** Picking an entry opens the file in the dock's document preview by its session file address. The panel does not render Markdown itself, so headings, formulas, figures, and frontmatter display come from the shipped preview. The address is built with the same session file address the preview package uses, not assembled by string concatenation.

**Empty and failure states.** With no `study/` folder, one line names the searched folder and the command that creates a Tracker. With no lectures in a topic, that topic carries one muted line. With a read failure, one line names the failure and the page keeps every entry it already built.

**Refresh.** The panel reads on mount. It keeps no refresh control, because the tab remounts when the learner opens it again.

**No writes.** The panel never creates, renames, deletes, or regenerates a file.

**Accessibility.** The page is a region named Lectures. Entries are buttons inside a list. The archived group is a button that reports its expanded state. Focus stays visible, and Enter or Space opens an entry.

**Manifest.** The client bundle keeps its current inject list unless the dock's package must be declared to load its slots, in which case one row is added. The host half and the configuration patch stay untouched.

## Testing Decisions

A good test drives the plugin through its public client surface and asserts what a learner sees. It mounts the client factory with a fake context, feeds a fake workspace file remote, renders the registered body, and checks the rendered tree and the reads the panel issued. It does not reach into private helpers, and it never asserts on style values.

The seam already exists in the client test file. The same mount helper, the same fake file remote keyed by path, and the same render-and-settle helper that the Study tab tests use carry this feature too. No new seam is added.

Cases to cover:

- The client registers exactly one dock tab type with kind `lectures`, one guide entry, and one body registration under the same key.
- The body lists two topics in name order and their lectures in Concept number order.
- A draft entry is marked as a draft and carries no date. A dated entry carries its teaching date.
- Archived files sit in the folded group and leave the main list.
- Picking an entry opens the document preview with the session file address of that lecture.
- A workspace with no `study/` folder names the searched folder and the command.
- A topic with no lectures shows its own empty line.
- A read failure shows one line and keeps the entries already built.
- A lecture with broken frontmatter keeps its number and title and shows no state.
- Reopening the panel requests one tab, not two.

Prior art: the Study tab block in the client test file, which mounts the same factory, injects a session id, feeds the same fake file remote, and asserts on rendered sections and list rows.

## Out of Scope

- Rendering Markdown inside the panel. The dock preview owns reading.
- Deleting, renaming, or regenerating a lecture.
- Any change to the Book builder or `book.html`.
- Duplicating the Tracker status page. The existing Study view tab keeps that job.
- Search, filters, sorting controls, or a table of contents.
- Reading outside the current workspace.
- A left-rail icon for the same page.

## Further Notes

The dock registry, the guide entry, and the session file address are host surfaces, not this plugin's. Verify each one against the installed host before building: the tab registry must accept a page kind with no file pattern, the guide entry must render the icon and the title, and `openResource` must accept the file address the preview package builds. If the registry is unavailable in the installed host, the fallback seat is a conversation view tab beside the existing Study tab, with the same list and the same preview call.

The dock page is not session-scoped by construction, so the session source is the one risk in this design. Confirm that the session service exposes the conversation in view before the panel is wired to reads.
