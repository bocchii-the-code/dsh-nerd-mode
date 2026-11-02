# Lectures list scope

Type: grilling
Status: resolved
Blocked by:

## Question

Does the Lectures tab list lectures from every Course in the workspace, grouped by Course, or only from the Course selected in the picker?

Evidence. Cite by anchor, not line number: the READMEs were rewritten during this session and line numbers moved.

- The Lectures bullet in the features list of `README.md` says the tab lists "the saved lectures for the selected Course". The architecture diagram and the file table also name the tab. So README and code agree.
- `GLOSSARY.md`, entry Lecture library, used to define it as "the read-only list of saved lecture copies in one workspace, grouped by Course". That was the only learner-facing doc claiming a workspace-wide list.
- `.scratch/study-lecture-library/spec.md`, Solution section, is the original design: "lists every saved lecture in the current workspace, grouped by topic".
- `.scratch/course-folders/spec.md`, Panel section, narrowed it later: "Each tab lists the selected Course only".
- Code follows the narrow rule: the Lectures page renders one Course, chosen by `topicPicker` in `client.js`.
- `topicPicker` returns null below two Courses (`client.js`, the `topics.length < 2` guard), so with one Course the tab shows no Course name at all.

## Answer

The tab lists the selected Course only. The code and the README agree, so the glossary was the outlier.

- **Concept.** "Lecture library" is the saved lecture copies for one Course. `GLOSSARY.md` entry Lecture library now reads "for one Course", with no mention of a workspace list or Course grouping.
- **Known limit.** With fewer than two Courses the picker hides itself, so the tab shows no Course name. Accepted as is: with one Course there is nothing to confuse, and the picker appears once a second Course exists.
- **READMEs.** No change needed. Both language versions already say the selected Course.
- **Old design note.** `.scratch/study-lecture-library/spec.md` now carries a line marking it superseded in part by `.scratch/course-folders/spec.md`.
- **No ADR.** The choice is cheap to reverse and asks nothing unusual of a future reader.
