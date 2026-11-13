# Update the plugin from npm or its GitHub repository

Status: accepted. Supersedes [0020](0020-plugin-update-button-uses-market-api.md).

The About block reads the newest release from the npm registry and installs it by running `pnpm add dsh-nerd-mode@<version> --save-exact` in the profile. DSH Market is no longer required for updates.

The same block updates a GitHub install. It reads `package.json` from the tracked ref of the official repository at `raw.githubusercontent.com` (`HEAD` when the spec names no ref), compares versions, and re-resolves the spec with `pnpm add <spec>`. A commit, a tag, or a `semver:` range counts as pinned and is never moved. A spec that names another repository is not checked.

Both channels are checked for every install that can update. The higher version wins even when it lives in the other channel, and the install switches the profile spec: an npm copy that finds a newer GitHub build runs `pnpm add github:<official>`, and a GitHub copy that finds a newer npm release runs `pnpm add dsh-nerd-mode@<version> --save-exact`. On a tie the installed channel stays, so nothing moves for nothing. The confirmation names the channel.

The host plugin manager cannot perform this update. It has no in-place update (#896), so a version change removes the bundle first. The removal unloads the plugin that would run the install (#900). Replacing the package files under a running host avoids both steps. Node keeps the old module in memory until a restart, so the install lands and the block asks for a restart.

## Considered Options

- **Keep the Market API (0020).** The block disappears for anyone who does not install Market, and Market itself must stay installed to receive its own fixes.
- **Check-only.** Safest, but the learner still needs a terminal, which is the problem the button solves.
- **Remove, then install through the host manager, with a recovery journal.** This is Market's own path. It is correct only with a journal written before the removal and a deadline around both steps. One plugin does not need to rebuild that machinery.
- **In-place `pnpm add` from the host half.** Chosen. One command, no removal, no journal.
- **Compare GitHub commits instead of versions.** Exact for a branch that commits without a release, but the page would show short hashes and the check needs git or the GitHub API's 60 requests per hour. Version comparison keeps one line and one set of copy for both sources.
- **Read the repository named by the install spec.** A fork could follow a different release line without saying so. Updates are checked against the official repository only.
- **Keep the installed channel and only read its version.** Simpler, but a release that reaches GitHub before npm, or npm before GitHub, would not be offered until the other channel catches up.

## Consequences

- The host half gains a route that runs pnpm. The route validates the version against `^\d+\.\d+\.\d+$`, uses the connection fence for auth, and allows one run at a time.
- A locked file on Windows makes the install fail. The block then points to Settings → Plugins, where the host manager updates after it unloads the plugin.
- Only pnpm profiles are supported. A profile without `pnpm-lock.yaml` gets the failure copy.
- There is no restart button. Market's restart probe depends on a supervisor; the block asks the user to restart DSH.
- `link:` installs never run the install. The block explains the correct path instead of changing the install source.
- A GitHub branch that commits without a version bump shows no update. That is the cost of comparing versions.
- An update can change the install source. The confirmation names the channel, and the profile spec follows it.
- A private repository is not supported. The raw file read carries no token.
- A git host other than GitHub, and a fork, is not checked. The block says so.
- The plugin now holds a write path into its own profile. The route refuses any npm version that is not a plain `major.minor.patch`, so it cannot be told to install another package.
