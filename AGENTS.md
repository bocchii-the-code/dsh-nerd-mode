## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles use the same strings as their names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root, plus decisions in `docs/adr/`. See `docs/agents/domain.md`.

### Skill versions

`package.json` holds the release version. The `study` and `study-plus` descriptions start with `[v<version>]`, so the skill catalog shows which copy loaded. Bump `package.json` and both descriptions in one change; `test/prompt-consistency.test.mjs` fails when they disagree. Keep the marker in the description: the loader strips frontmatter before the model sees the skill, so a `version:` field stays invisible.

### Git

One agent per working tree. Before a read or write that depends on the branch,
run `git branch --show-current`.
