# Update the plugin through the DSH Market API

Status: superseded by [0022](0022-plugin-update-runs-pnpm.md)

The Nerd Mode settings page offers an update button. DSH Market already installs packages in a profile, verifies the version that lands on disk, keeps a recovery point, and can restart the host. The alternatives were the plugin running `dsh plugin add` or pnpm itself, which would need shell access, its own verification, and its own restart path, or a check-only button that only copies the command. The block therefore calls the Market's public Update API v1 from the client and adds no server code. The cost is a dependency on an API still marked beta: capability detection must fail soft, so a Market release that renames fields degrades the block to an explanation and a manual command instead of breaking the settings page.

## Considered Options

- **Check-only.** Safest, no dependency on a beta API, but the learner still runs a terminal command, which is the problem the button solves.
- **Server-side install.** The plugin spawns `dsh plugin add` through the host shell. It duplicates Market's source resolution and version verification, and a plugin that installs packages is a larger trust surface than a settings page should carry.
- **Embed the Market panel.** `market.render()` gives a whole panel with its own chrome. It cannot show Nerd Mode copy or stay inside the settings section.

## Consequences

- The block shows nothing useful when the Market plugin is absent, so it always prints the manual command.
- A `link:` install cannot be updated through the API. The block reports the local state instead of failing.
- Field renames in a later Market release reach users as the unavailable copy, not as an exception.
