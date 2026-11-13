# Changelog

Every npm release of `dsh-nerd-mode` gets an entry here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/), newest first.

## [0.5.2] - 2026-11-13

### Changed

- The About group reads the newest release from npm through the plugin's own host route. It no longer needs DSH Market.
- A GitHub install updates too: the check reads the official repository at the tracked ref, and the button re-resolves the spec. A pinned ref and a fork are not checked.
- The check reads both npm and the official GitHub repository. The higher version wins, and the update moves the install source to that channel.
- The update button installs by running `pnpm add dsh-nerd-mode@<version> --save-exact` in the profile, then asks for a DSH restart.
- A `github:` install explains that one reinstall in Settings → Plugins switches it to npm. A `link:` install keeps the git note.

### Removed

- The restart button and the DSH Market capability, update, operation, and restart calls.

## [0.5.1] - 2026-11-12

### Changed

- The settings panel, the Study view, the Lectures pane, and the Study Sessions page share one visual scale: spacing at 4, 8, 12, 16, 24, and 32, controls 32px high, radii 6 and 10, text at 12, 13, and 15. Each group is a card on the theme surface, so a long form reads as separate blocks instead of one dense list.
- Every color still comes from the host theme tokens, so light and dark both follow the host. No hex value reaches the UI.
- The Study view and the Lectures pane follow the interface language. Their labels, empty states, failure lines, and slot names now have Chinese text.

### Fixed

- The settings group with question count and type aligns its title with its controls. The title no longer floats to the middle of the card.
- The English interface no longer shows a Chinese subtitle under the recall setting. It reads "Recall Session" in English and "课前回忆" in Chinese.

### Removed

- Four packages no file imported: `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`, and `@astryxdesign/cli`. The install no longer carries them.

## [0.5.0] - 2026-11-11

### Added

- A Study Sessions panel in the left sidebar, after Context Insights. It lists every conversation where Nerd Mode was switched on at least once, in three groups: In-depth, Quick, and Past. A row shows the conversation title, its workspace, and when it last changed. A click opens that conversation.
- The panel keeps its own record of past conversations in `~/.dsh/study-sessions-index.json`, so a conversation stays listed after it closes. The first scan of 201 conversations takes about 6 seconds, runs in chunks, and shows progress.
- The panel reads through a read-only route. It answers only GET, and it refuses a request with no session cookie (401) or a foreign host or origin (403).

### Changed

- Each group on the Study Sessions page folds from its heading, and a folded group keeps its count. In-depth and Quick start open, and Past starts closed with a mode chip on each row.
- The Study Sessions and Lectures pages share one row layout: an icon, the title, a metadata line, and the time at the right edge. In a narrow pane the time moves under the title.
- The Lectures page keeps the course picker in its header and lists only the courses that exist. The archived lectures fold shows its count and a chevron.

## [0.4.6] - 2026-11-05

### Fixed

- The book page shows its left chapter list, numbers each lecture as `1.1` in the list and the title, and scrolls the list on its own.
- A display formula written as `\[ ... \]` renders as math instead of literal brackets.

### Changed

- The Lectures page keeps its course list in view and opens a lecture in a tab.
- The `study` and `study-plus` descriptions start with the package version, so the loaded copy is visible.

## [0.4.5] - 2026-11-02

### Added

- An About group in the Nerd Mode settings section shows the installed and the newest npm version, and installs the newer release through DSH Market's update API.
- The settings page follows the DSH interface language: English and Chinese.

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
