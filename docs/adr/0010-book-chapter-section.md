# Book, Chapter, and Section stay separate from the concept tracker

Status: accepted, 2026-10-28.

v3 gives each topic a Book of Chapters and Sections. The book order comes from the learner's textbook or from a proposed teaching grouping. The tracker keeps one state per concept, and the learning order stays in prerequisite order. The two orders serve different readers. The book serves rereading and navigation. The tracker serves the choice of what to teach next.

Coupling them was rejected. Making a Chapter the unit of assessment would hide which concept failed and break prerequisite steering. Making a Chapter one lecture file would mix concepts with separate states, and a retake of one concept would rewrite the others. Keeping Sections as flat labels with no Chapter would lose the source's structure and turn the book page into a list.

Consequences. The graph carries both orders. The builder refuses an invalid or duplicate Chapter or Section mapping. A migration may rename a lecture file when a concept keeps its name and changes position, and it asks when the name is not unique. Orphan lecture files are reported, not deleted. A Concept that a graph change removes has its file moved to `lectures/archive/`, so the page stays clean and the material stays readable.

As of [ADR 0011](0011-drafts-and-free-selection.md), the page also carries prepared drafts, labels them as draft content, and rebuilds itself after a draft batch, a saved Lecture, or a graph change. Every rebuild backs up the previous page to `book.html.bak` and leaves the current page intact when it fails.
