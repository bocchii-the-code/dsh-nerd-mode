# Changelog

Every npm release of `dsh-nerd-mode` gets an entry here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/), newest first.

## [0.4.4] - 2026-11-02

### Removed

- The bundled `teach` skill. A `teach` workspace keeps its files: `MISSION.md`, `lessons/`, `reference/`, `learning-records/`, and `assets/` stay where the learner put them.

## [0.4.3] - 2026-11-01

### Changed

- The path item lists only Courses that exist, labels a single Course as the current Course, and keeps "one concept per session" in the question text instead of the option labels.
- A new Course from the path item asks for its name once. A name that matches an existing Course asks whether to continue it or use another name.
- A post-lecture multiple-choice question is one `question` call with four labeled options in shuffled positions. A typed answer that names an option counts as choosing it, a dismissed card re-asks once and never counts as a miss, and a host without the tool gets a numbered text list.

## [0.4.2] - 2026-11-01

### Fixed

- The graph approval shows the full table in the reply, not in the question text, so the card no longer prints raw table pipes.

## [0.4.1] - 2026-11-01

### Changed

- The opening question offers single choices for the goal, the background, and the path. Labels follow the learner's language, free input stays available, and a host without a choice tool gets a numbered text list.
- A brief from the upper layer is final, so `study` never asks again for a goal or a background that the brief leaves out.

## [0.4.0] - 2026-10-31

### Added

- Lectures dock page: a card lists every lecture saved in the workspace, marks read, unread, and archived rows, and opens a lecture in the preview.
- Opening calibration for each Course: one question round sets the teaching level, and every later lecture follows it.
- Checks for the prompt text and for every README image.

### Changed

- The record for one subject is now called a Course. Both READMEs, the glossary, and every panel label use the word, and an existing `study/<slug>/` folder is already a Course.
- The Study tab and the Lectures tab share one Course picker and show only the selected Course.
- `/study-plus <course>` settles the Course with no question, and the Course question never repeats in a conversation.
- `study` and `study-plus` teach at the calibrated level.
- READMEs gained a key features section and drawn figures for the mode choice, the two learning paths, and calibration.
- The tracker panel stays visible before settings arrive.

### Fixed

- Book builds stay offline.
- Lecture entry marks and archived rows use the right names.
- The plugin stays active when the dock is unavailable.

## [0.3.0] - 2026-10-30 (unpublished)

Tagged `v0.3.0` but never published. Its changes first shipped in `0.4.0`.

### Added

- Nerd Mode settings page: profile defaults for the Recall Session switch, the unseen question count, and the question type.
- Tracker status panel tab in the conversation view.
- Automated checks for the HTML book.

### Changed

- `study-plus` reads the profile defaults for the Recall Session and for unseen question slots.
- The tracker panel got a tighter hierarchy and spacing.
- Skill docs define each symbol where the reader first meets it.
- Docs moved into `docs/`, with specs and ADRs updated.
- Both READMEs open with a drawn portrait.

### Fixed

- Study settings apply when the skill starts inside a code step.

## [0.2.1] - 2026-10-27

### Fixed

- Nerd Mode failures show a toast with the reason instead of failing silently.

## [0.2.0] - 2026-10-27

### Added

- Nerd Mode switch: `/nerd-mode on` and `/nerd-mode off`, with a pill and an icon.
- Bundled skills `study`, `study-plus`, `diagram`, and `answer-me-with-html`.
- Chinese README with a language switcher.
- Repository metadata for the npm page.

### Changed

- Study mode is a per-session overlay instead of a preset.
- Package and repository renamed to `dsh-nerd-mode`.
- Both READMEs restructured: purpose first, each lesson explained before the file table, tighter prose.
