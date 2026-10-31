# Spec: A Course is the record for one subject

Status: accepted

## Problem Statement

Each subject in a workspace is recorded in `study/<slug>/`, and the repo calls that folder a topic. No glossary entry defines the word, and the ordinary sense of "topic" is broader than the record. A workspace already holds several such folders, but both reading surfaces list every one of them at once, so a learner running two conversations cannot tell which record belongs to which effort. The skill picks a folder by slug and never says which record it is in.

## Solution

Name the record unit a Course. A Course is one folder under `study/`: one graph, one state file, one log, its lectures, its figures, and its Book. The layout on disk does not change; an existing `study/algebra/` is already a Course. A conversation settles one Course at its first tracked study and stays in it. The Lectures tab and the Study tab show that Course only, through a picker they share.

## User Stories

1. As a learner with two subjects in one workspace, I want each one called a Course, so that I have a word for the record I am reading.
2. As a learner starting a tracked Course, I want the choice settled once, so that later turns never ask again.
3. As a learner in a workspace with one Course, I want no question at all, so that the obvious choice costs me nothing.
4. As a learner naming a new Course, I want to type the name in my own words, so that I do not have to design a slug.
5. As a learner asking about a second subject, I want one question that offers the current Course or a new one, so that my concepts land where I mean.
6. As a learner typing `/study-plus linear-algebra`, I want the Course set from the command, so that I can reach a second Course without a question.
7. As a learner typing a Course that does not exist, I want one confirmation, so that a typo does not leave a stray folder.
8. As a learner opening the Lectures tab, I want a Course picker, so that I read the Course I am in.
9. As a learner opening the Study tab, I want the same picker and the same choice, so that the two tabs agree.
10. As a learner with an older record, I want it to keep working untouched, so that no migration has to run.
11. As a learner saving a figure in a tracked Course, I want it inside that Course, so that two Courses never share a picture.
12. As a learner running `/study` alone, I want the figure at `diagrams/<name>.svg`, so that a one-off lesson creates no record folder.
13. As a learner building the Book, I want the command to take `study/<course>`, so that the path I see is the path I type.

## Implementation Decisions

**Layout.** A Course lives at `study/<course>/` and holds `graph.md`, `state.md`, `log.md`, `lectures/`, `lectures/archive/`, `diagrams/`, and `book.html`. This is exactly today's layout. Nothing moves, and no migration runs.

**Course names.** The learner types a name. The skill turns it into a lowercase kebab-case slug with the same sanitizing it applies today. One folder per Course, named by the slug. No marker file sits inside a Course: the folder name is the name.

**Selection.** The first tracked study in a conversation settles the Course.

- No Course at all: ask for a name.
- Exactly one Course: use it and name it in one line. Ask nothing.
- Several: ask one question that lists them and offers a new Course.
- The opening question, when it runs, carries the Course in its path item: one complete answer, then one tracked option per Course, then tracked in a new Course. One round, no separate question.
- An explicit `/study-plus` skips the opening question, so the Course question stands alone there.

The answer holds for the rest of the conversation. The Course question never repeats.

**Second subject.** One Course holds one graph. When the conversation has a Course and the learner asks about a different subject, ask one question with two options: add these concepts to the current Course, or start a new Course. The first option is a graph change, which the skill already supports. Never ask two questions in one turn.

**Command argument.** `/study-plus <course>` sets the Course with no question. When the named Course does not exist, ask once whether to create it, then continue. Update the frontmatter `argument-hint` to show the Course slug.

**Graph heading.** A new `graph.md` opens with `# Course: <name>`. A reader accepts `# Topic:` as well, so every existing file keeps its title. When neither line is present, the title falls back to the folder slug. The skill never rewrites an existing heading.

**Panel.** `TRACKER_ROOT` stays `'study'`. The Study tab's existing picker becomes the Course picker, labelled Course. The Lectures tab gains the same picker. The two tabs share one selection, held in one module-level variable in the client bundle. The picker opens on the last selection made in this client session, otherwise on the only Course, otherwise on the first by name. Each tab lists the selected Course only. A missing `study/` keeps the current message.

**Vocabulary.** User-facing text says Course: the picker label, the empty states, the error lines, the skill text, the router text, the READMEs, and the glossary. Internal JavaScript identifiers keep their current names, so a reader of `client.js` still sees `topicPicker` and `loadTopic`. Renaming them changes no behavior, and this spec does not ask for it.

**Figures.** A tracked Course saves its SVG at `study/<course>/diagrams/<name>.svg`, which is today's path. The guide skill writes the same path when the upper layer scopes a Course. When the guide runs alone, it writes `diagrams/<name>.svg`, with no Course folder.

**Book build.** `build-book.mjs` keeps its logic and its one-level rule. Only its messages change: a Course folder, not a topic folder. Internal names stay.

**Docs.** `GLOSSARY.md` gains a Course entry and drops the word topic wherever it names the record. `docs/adr/0016-course-folders.md` records the decision. Both READMEs and the CHANGELOG change with the code.

## Testing Decisions

A good test drives a public surface and asserts what a learner sees. Client tests mount the client factory with a fake context and a fake workspace file remote keyed by path, then check the rendered tree and the reads issued. They never assert style values.

Each ticket carries its own tests. The client ticket adds a two-Course fixture and a shared-selection assertion. The book ticket keeps its fixture and updates the strings it pins. The doc ticket runs the changelog test, which pins the newest entry to the package version.

## Out of Scope

- Moving or renaming an existing `study/<slug>/` folder.
- Renaming the root from `study`.
- A settings field for a default Course.
- Rewriting `# Topic:` headings in existing graphs.
- Renaming internal JavaScript identifiers.
- A display name for a Course other than its slug.

## Further Notes

The word topic survives only inside `graph.md` of older files, in internal JavaScript names, and in historical specs under `docs/specs/`. None of those is product vocabulary.

The changelog test rejects an Unreleased heading and pins the newest entry to `package.json`. The change therefore lands in the current `0.4.0` entry.
