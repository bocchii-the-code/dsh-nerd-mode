# Spec: An update button in the Nerd Mode settings page

Status: accepted

## Problem Statement

Learners install `dsh-nerd-mode` with `dsh plugin --profile <profile> add dsh-nerd-mode`. Nothing in DSH says a newer release exists, and nothing installs it. A learner must remember the command, the profile name, and to check npm. The Nerd Mode settings page is where they already look for this plugin, so it is the right place to answer "am I current?".

## Solution

Add an **About** group at the bottom of the Nerd Mode settings section. It shows the installed version and the newest npm version, and one button installs the newer release through DSH Market's public update API.

DSH Market already owns package installation in a profile: it resolves the source, runs pnpm, verifies the version that landed on disk, keeps a recovery point, and can restart the host. The button calls that API. The plugin never runs a package manager and gains no server-side code.

## User Stories

1. As a learner opening Settings, I want the installed and newest versions side by side, so that I know whether to act.
2. As a learner with an available release, I want one confirmed click to install it, so that I do not memorize CLI commands.
3. As a learner after an install, I want to be told the new version needs a restart, so that I do not keep testing the old one.
4. As a learner on a host that permits restarts, I want a restart button next to that message, so that I finish in one place.
5. As a learner offline or behind a failing registry, I want the actual error and a command I can run later.
6. As a developer running a local `link:` install, I want the block to say the copy is local, so that I do not expect npm to update it.
7. As a developer whose local version is ahead of npm, I want no downgrade offer, so that unpublished work survives.
8. As a learner whose host lacks the Market plugin, I want one sentence and a copyable command, so that the block degrades instead of disappearing.
9. As a Chinese-language user, I want the whole settings page in Chinese, so that the new block matches the rest.
10. As a keyboard or screen-reader user, I want checking, progress, and failure announced, so that I do not watch the button.

## Implementation Decisions

### Placement

- A third group sits after the Save/Cancel row: header "About", one version line, one action, one feedback line.
- It renders in every branch of the settings entry, including "settings unavailable", because an update does not depend on config forms.
- It uses the same group, title, button, and feedback styles as the existing groups.

### Data source

All calls are same-origin `fetch` with cookies, against DSH Market's v1 API:

1. `GET /dsh-market/api/v1/capabilities` on mount. Read `features.update`, `features.restart`, `profile`, and `endpoints`.
2. `GET <endpoints.updates>?name=dsh-nerd-mode` for the versions. The automatic check omits `force`; a manual "Check again" adds `force=1`.
3. `POST <endpoints.updates>` with `{ "packageName": "dsh-nerd-mode" }`. Expect `202` and `operationId`.
4. `GET <endpoints.operations>?operationId=<id>` every second until a terminal state. Stop on unmount.
5. `POST <endpoints.restart>` with `{}` only when `features.restart` is true.

Requirements:

- Discover every path from `endpoints`; only the capabilities path is a constant.
- Reject a response whose `schema` is not `dsh-market/update-api/v1`.
- Abort a request after 10 seconds and treat it as a failure with a readable message.
- Never call `POST` endpoints before `features.update` is true.
- `RELEASE_TOO_FRESH` and `VERSION_UNCHANGED` keep the retry actionable: the retry sends `force: true`.

### States

| State | Version line | Action | Feedback |
|---|---|---|---|
| Checking | "Checking…" | none | — |
| Up to date | "Installed vA · latest vA" | "Check again" | — |
| Update available | "Installed vA · latest vB" | "Update to vB" | — |
| Confirming | same | "Update" and "Cancel" inline | "Install vB and restart DSH afterwards?" |
| Updating | same | disabled | operation progress text |
| Installed | "Installed vB" | "Restart now" when `features.restart`, else "Check again" | "Restart DSH to use vB." |
| Local version newer | "Local vA · npm vB" | "Check again" | "This copy is newer than npm. No update." |
| Local link install | "Local vA" | "About local installs" | clicking reveals "This copy is linked to a folder. Update it with git, not npm." |
| Market unavailable | none | none | explanation plus the manual command |
| Failed | same | "Try again" | the failure message plus the manual command |

Confirming is inline. Do not use `window.confirm`.

### Copy and language

- Every string in the settings section becomes a `{ en, zh }` pair, including the existing title, group names, field labels, hints, Save/Cancel, and feedback lines.
- Text resolves through the host locale service, which also drives re-rendering on a language switch. No local language detection.
- The settings entry registers under a `locale` injection, the same pattern the sidebar uses.
- Chinese copy follows `GLOSSARY.md` terms: 课前回忆, 讲义, 概念.

### Manual command

The fallback line is `dsh plugin --profile <profile> add dsh-nerd-mode`, with the profile name from `capabilities.profile`. When capabilities failed, print `<profile>` literally so the command stays copyable.

### Version comparison

Trust `updateAvailable` for the update decision. Show the local-newer state only when both versions parse as `major.minor.patch` and the installed one is greater. Do not reimplement prerelease ordering.

### Boundaries

- No new server code, no shell, no direct pnpm or npm invocation.
- No automatic installs and no background checks; the only automatic request is the check on mount.
- Only `dsh-nerd-mode` is updated.
- No rollback button, no channel switch, no Market panel embedding.

## Testing Decisions

Client tests follow the existing harness: a fake context, a stubbed `fetch`, and assertions on the rendered tree and the requests issued. They never assert style values.

Coverage:

- The mount check renders both versions and issues no `force`.
- An available update asks for confirmation; confirming posts the package name once; polling reaches success and shows restart copy.
- `features.restart: false` hides the restart button.
- A `linked` source renders the local state and posts nothing.
- An installed version above the latest renders the local-newer copy.
- Missing capabilities or a failed check renders the manual command with the profile from capabilities when present.
- A failed operation renders its message and a retry.
- `zh` resolves the whole section, not only the new block.
- Unmount stops the poll timer.

Run `npm test` and `npm run lint` after the change.

## Out of Scope

- Updating other plugins, or the Market's own panel.
- Rollback controls.
- Automatic updates, or a check without opening Settings.
- Release channels and prerelease ordering.
- A changelog view inside the block.
- Telemetry.

## Further Notes

- The API is beta. Capability detection is the contract: a renamed field or an older Market must land on the unavailable copy, never crash the settings page.
- On this machine the profile installs the plugin as `link:`, so the first real run shows the local-install state. The update path needs an npm-installed profile to exercise by hand.
- Version `0.4.5` and its CHANGELOG entry land with the code. ADR 0020 records the choice.
