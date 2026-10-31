# A Course names the record for one subject

Status: accepted, 2026-10-31.

The repo records each subject in `study/<slug>/` and calls that folder a topic in both skills, the client, the build script, and several ADRs. No glossary entry defines the word. A workspace can already hold several such folders, but both reading surfaces list all of them at once, so a learner running two conversations cannot tell which record belongs to which effort, and the skill enters a folder without naming it.

The record unit is now a Course. A Course is one folder under `study/`: one concept graph, one state file, one log, its lectures, its figures, and its Book. The layout does not change, so an existing `study/algebra/` is already a Course and nothing moves. A conversation settles one Course at its first tracked study. The Study tab and the Lectures tab gain one shared Course picker and show that Course only. New graphs open with `# Course: <name>`, and readers accept `# Topic:` so older files keep their title.

Alternatives. Adding a Course level above the record, as `study/<course>/<topic>/`, was rejected: it adds a folder nobody needs, and the folder under `study/` is already one subject. Per-course roots such as `study_algebra/` at the workspace top were rejected: finding them needs a scan of the workspace root, which the workspace file remote does not offer. Keeping the word topic was rejected: it is undefined, and its ordinary sense is wider than one recorded subject. Migrating folders to a new root was rejected: the layout is already what the new name describes.

Consequences. User-facing strings say Course, while internal JavaScript names keep the old word, because renaming them changes no behavior. The guide skill writes a scoped figure into `study/<course>/diagrams/` and keeps `diagrams/<name>.svg` when it runs alone. `build-book.mjs` changes no logic, only its messages. `GLOSSARY.md` gains Course and loses topic wherever the record is meant.
