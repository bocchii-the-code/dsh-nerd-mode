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

### Publishing

A pushed `v<version>` tag is the only release action. The `publish` workflow
checks the tag, runs `npm run check`, publishes with npm trusted publishing,
and creates a GitHub Release. The repository holds no npm token. Tag creation
is limited to administrators.

Before a tag, put the version bump, the `## [<version>]` changelog section, and
both skill description markers in one commit. Run `npm run check`, push `main`,
then tag that commit:

```bash
git tag v0.5.2
git push origin v0.5.2
```

The run refuses a prerelease tag, a tag that differs from `package.json`, a
missing changelog section, a commit outside `main`, an already published
version, or a failed check. Never run `npm publish` locally.

If the run fails before the upload, fix the commit and move the tag. A
published version cannot be replaced: deprecate it and publish a patch. Use
`npm unpublish` only inside the 72-hour window. Details:
`docs/releasing.md`. Decision:
`docs/adr/0024-publish-from-a-tag-with-trusted-publishing.md`.

<!-- ASTRYX:START -->
Astryx v0.7.13 · 174 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->
