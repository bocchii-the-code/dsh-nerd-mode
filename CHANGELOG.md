# Changelog

Every npm release of `dsh-nerd-mode` gets an entry here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/), newest first.

## [0.4.0] - 2026-10-31

### Added

- Lectures dock page: a card lists every lecture saved in the workspace, marks read, unread, and archived rows, and opens a lecture in the preview.
- Opening calibration for each topic: one question round sets the teaching level, and every later lecture follows it.
- Checks for the prompt text and for every README image.

### Changed

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
