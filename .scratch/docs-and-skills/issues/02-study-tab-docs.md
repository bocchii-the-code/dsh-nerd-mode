# Study tab documentation coverage

Type: grilling
Status: resolved
Blocked by:

## Question

Should the Study tab get a feature-level description in the two READMEs, and does `GLOSSARY.md` need a term for it?

Evidence. Cite by anchor, not line number: the READMEs were rewritten during this session and line numbers moved.

- The tab exists and is tested: `StudyView` in `client.js`, registered in the same file, design in `docs/specs/2026-10-29-tracker-panel.md`.
- The READMEs are not silent. The architecture diagram and the file table both name the Study tab, in both languages. Neither says what it shows.
- The features list in `README.md` covers the switch, the two learning skills, the graph, the question round, the fork, evidence, the record, and the Lectures tab. The Study tab is the only shipped surface missing from that list.
- `GLOSSARY.md` defines Tracker but has no entry for this panel. It does define Lecture library, a comparable read-only surface.
- Names disagree. The tab label and both README mentions say "Study". The spec title and the changelog say "Tracker status panel".
- What the panel shows, per the spec's Solution section: progress percentage, a previous/current/next strip in Book order, the shaky Concepts, the three most recent Concept cycles, and a Course picker.

## Answer

Add one feature bullet to the features list in both READMEs. Add no glossary term.

- **Why a bullet.** The panel answers the question between lessons: how far am I, what did I just study, what comes next. The file map does not say that, and the feature list is where a learner decides whether to care.
- **Why no glossary term.** `GLOSSARY.md` holds domain vocabulary. This panel is a read-only view of the Tracker, and Tracker is already defined. Adding a surface name would pull implementation detail into the glossary.
- **Name.** The docs call it the Study tab, because that is the label on the screen. The spec keeps its own title, Tracker status panel, as a design record.
- **Chinese.** Both files take the bullet in the same pass. No sync rule exists yet, so this is manual parity.

English bullet, placed after the record bullet:

`- **Progress without opening a file.** The Study tab reads the Tracker for this conversation and shows one progress percentage, the previous, current, and next Section, the shaky Concepts, and the three most recent Concept cycles. It never writes.`

Chinese bullet, same position:

`- **不用翻文件就能看进度。** Study 标签页读当前对话的 Tracker，显示一个进度百分比、上一节、当前、下一节三格、Shaky 的概念，以及最近三轮概念循环。它只读不写。`

- **Landed.** Both bullets sit in the features list, English in `README.md`, Chinese in `README.zh.md`. `node --test` still reports 109 passing tests.
- **Anchor, not line number.** Another writer renamed the list heading from "Key features" to "Features" and reworded one bullet while this session ran, so the tickets cite the bullet sentence, never a line number.
