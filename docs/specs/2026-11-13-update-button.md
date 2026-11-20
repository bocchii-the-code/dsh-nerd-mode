# Spec: An update button in the Nerd Mode settings page

Status: accepted. Rewritten after ADR 0022. The Market version lives in git history and in ADR 0020.

## Problem Statement

Learners install `dsh-nerd-mode` with `dsh plugin --profile <profile> add dsh-nerd-mode`. Nothing in DSH says a newer release exists, and nothing installs it. A learner must remember the command, the profile name, and to check npm. The Nerd Mode settings page is where they already look for this plugin, so it is the right place to answer "am I current?".

## Solution

Add an **About** group at the bottom of the Nerd Mode settings section. It shows the installed version and the newest version from the same source. One button installs the newer release.

The plugin does the work itself. Its host half reads the profile manifest, asks npm and the official repository for their newest version, and keeps the higher one. It then runs pnpm in the profile for that channel. For npm that is `pnpm add dsh-nerd-mode@<version> --save-exact`. For GitHub it is `pnpm add <spec>`, which re-resolves the tracked ref. No other plugin is required.

The host plugin manager cannot perform this update. It has no in-place update (#896), so a version change removes the bundle first, and that removal unloads the plugin that would run the install (#900). ADR 0022 records the full reasoning.

## User Stories

1. As a learner opening Settings, I want the installed and newest versions side by side, so that I know whether to act.
2. As a learner with an available release, I want one confirmed click to install it, so that I do not memorize CLI commands.
3. As a learner after an install, I want to be told the new version needs a restart, so that I do not keep testing the old one.
4. As a learner offline or behind a failing registry, I want the actual error and a place to go next, so that the page does not dead-end.
5. As a developer running a local `link:` install, I want the block to say the copy is local, so that I do not expect npm to update it.
6. As a developer whose local version is ahead of npm, I want no downgrade offer, so that unpublished work survives.
7. As a learner with a GitHub install, I want the same update check, so that a new release reaches me without a reinstall.
8. As a Chinese-language user, I want the whole settings page in Chinese, so that the new block matches the rest.
9. As a keyboard or screen-reader user, I want checking, progress, and failure announced, so that I do not watch the button.

## Implementation Decisions

### Placement

- A third group sits after the Save/Cancel row: header "About", one version line, one action, one feedback line.
- It renders in every branch of the settings entry, including "settings unavailable", because an update does not depend on config forms.
- It uses the same group, title, button, and feedback styles as the existing groups.

### Data source

All calls are same-origin `fetch` with cookies, against the plugin's own host route:

1. `GET /dsh-nerd-mode/api/update` on mount. The body is `{ installedVersion, source, latestVersion, channel, registry, error, github }`. `channel` is the source of the newest version (`npm` or `github`). `github` is `{ repo, ref, pinned, official }` for a GitHub install, otherwise null.
2. `GET /dsh-nerd-mode/api/update?force=1` for a manual "Check again".
3. `POST /dsh-nerd-mode/api/update` with `{ "version": "<major.minor.patch>" }` after confirmation.

Requirements:

- Abort a status request after 10 seconds and an install request after 300 seconds.
- Never run two requests at once. Unmount aborts the open request.
- The host reads the install source from `<profile>/package.json`. The client never guesses it.
- Registry order is `registry.npmjs.org`, then `registry.npmmirror.com`. The body reports which one answered.
- A GitHub install reads `https://raw.githubusercontent.com/<official repo>/<ref or HEAD>/package.json`.
- A GitHub ref that is a commit, a tag such as `v1.2.3`, or a `semver:` range is pinned. A pinned ref and a repository other than the official one skip the network.
- A source that is not npm or GitHub skips the network entirely.
- Both channels are checked for an npm or GitHub install. The higher version wins; a tie keeps the installed channel.
- Accept `dist-tags.latest` and a GitHub `version` only when it matches `^\d+\.\d+\.\d+$`.
- A 404 means the running host loaded the previous build. The host registers routes at startup, so the block names a restart instead of the Plugins page.

### Install

- The request carries `{ version, channel }`. The channel picks the install: npm writes a pinned version, GitHub re-resolves the spec. An npm copy that takes a GitHub version gets the `github:<official>` spec.
- For npm, the host runs `pnpm add dsh-nerd-mode@<version> --save-exact` in the profile with `shell: false` and a 300 second timeout. The version must match `^\d+\.\d+\.\d+$` first.
- For GitHub, the host runs `pnpm add <spec>` with the unchanged manifest spec, then reports the version that landed in `node_modules`.
- A pinned GitHub ref and a repository other than the official one return 409.
- A second install while one runs returns 409.
- Success returns the installed version. The old module stays in memory until DSH restarts.

### States

| State | Version line | Action | Feedback |
|---|---|---|---|
| Checking | "Checking…" | none | — |
| Up to date | "Installed vA · latest vA" | "Check again" | — |
| Update available | "Installed vA · latest vB" | "Update to vB" | — |
| Confirming | same | "Update" and "Cancel" inline | "Install vB from `<channel>` and restart DSH afterwards?" |
| Installing | same | disabled | "Installing vB…" |
| Installed | "Installed vB" | none | "Restart DSH to use vB." |
| Local version newer | "Local vA · npm vB" | "Check again" | "This copy is newer than npm. No update." |
| Local link install | "Local vA" | "About local installs" | clicking reveals "This copy is linked to a folder. Update it with git, not npm." |
| GitHub install, update | "Installed vA · latest vB" | "Update to vB" | — |
| GitHub install, pinned | "Installed vA" | none | "Pinned to `<ref>`. No update check." |
| GitHub install, other repo | "Installed vA" | none | "Installed from `<repo>`. Updates are checked against the official repository only." |
| Check failed | none | "Check again" | the error plus "Open Settings → Plugins to update there." |
| Host older than the page | none | "Check again" | "This copy of DSH has not loaded the update route. Restart DSH." |
| Install failed | the version line | "Check again" | the error plus "Open Settings → Plugins to update there." |

Confirming is inline. Do not use `window.confirm`.

### Copy and language

- Every string in the settings section becomes a `{ en, zh }` pair, including the existing title, group names, field labels, hints, Save/Cancel, and feedback lines.
- Text resolves through the host locale service, which also drives re-rendering on a language switch. No local language detection.
- The settings entry registers under a `locale` injection, the same pattern the sidebar uses.
- Chinese copy follows `GLOSSARY.md` terms: 课前回忆, 讲义, 概念.

### Failure path

There is no manual command. The old fallback `dsh plugin --profile <profile> add dsh-nerd-mode` is refused for an installed package, so it never upgraded anything. A failure instead points to Settings → Plugins, where the host manager removes and reinstalls the bundle.

### Version comparison

`latestVersion` is the higher of the two channel versions. A tie keeps the installed channel. Show the local-newer state only when both remote versions parse as `major.minor.patch` and the installed one is greater than the higher of them. Do not reimplement prerelease ordering.

For GitHub, the version comes from the `version` field of the remote `package.json` at the tracked ref. The install re-resolves the ref, so the version that lands can be newer than the one shown if the branch moved.

### Boundaries

- The host route is the only code that runs a package manager.
- No automatic installs and no background checks. The only automatic request is the check on mount.
- Only `dsh-nerd-mode` is updated.
- Only the official GitHub repository is checked. A fork and a private repository are not.
- A GitHub branch that commits without a version bump shows no update.
- A cross-channel update changes the profile spec. It stays one confirmed action, and the confirmation names the channel.
- No rollback button, no channel switch, no Market panel.
- No restart button.

## Testing Decisions

Host tests use the route factory with an injected status reader, registry reader, and installer. They never touch the network or pnpm.

Coverage:

- The connection fence rejects with 401 and 403.
- A non-GET status request returns 405.
- An npm source returns both versions; a mirror answer is reported when npm fails; both failing sets `error`.
- `force=1` bypasses the cache.
- A `link:` source skips the network.
- A GitHub spec is classified and parsed into repo, ref, and pinned state, including `github:`, shorthand, HTTPS, SSH, commit, tag, and semver forms.
- A GitHub install reads the official repository at the tracked ref, and `HEAD` when no ref is named.
- A pinned ref and another repository skip the network.
- A repository failure sets `error` and keeps the 200.
- The check takes the higher of npm and GitHub and reports its channel; a tie keeps the installed channel; one failing channel does not fail the check.
- The install rejects a malformed version with 400, a link source with 409, a pinned ref with 409, another repository with 409, and a concurrent run with 409.
- A successful npm install spawns pnpm with the exact arguments and profile directory.
- A successful GitHub install calls the installer with the unchanged spec and reports the version on disk.
- A cross-channel POST installs from the channel in the body.
- A non-zero exit returns 500 with the message.

Client tests follow the existing harness: a fake context, a stubbed `fetch`, and assertions on the rendered tree and the requests issued. They never assert style values.

Coverage:

- The mount check renders both versions and issues no `force`.
- An available update asks for confirmation; confirming posts the version once; success shows the restart copy.
- A failed check and a failed install each show their message and the Settings → Plugins hint.
- A `link:` source renders the local state, the revealed note, and posts nothing.
- A GitHub source offers the same update as npm when the repository is official.
- A pinned GitHub ref and another repository show their note and offer no update button.
- The confirmation names the channel, and the POST carries it.
- An installed version above the latest renders the local-newer copy.
- `zh` resolves the whole section, not only the new block.
- Unmount aborts the open request.

Run `npm test` and `npm run lint` after the change.

## Out of Scope

- Updating other plugins.
- Rollback controls.
- Automatic updates, or a check without opening Settings.
- Release channels and prerelease ordering.
- Commit-level update detection for GitHub. The version on the ref is the signal.
- Private GitHub repositories, and git hosts other than GitHub.
- npm profiles. The host route runs pnpm only.
- Restarting DSH from the page.
- A changelog view inside the block.
- Telemetry.

## Further Notes

- On this machine the profile installs the plugin as `link:`, so the first real run shows the local state. The npm path needs a registry-installed profile to exercise by hand.
- Version `0.5.2` and its CHANGELOG entry land with the code. ADR 0022 records the choice.
