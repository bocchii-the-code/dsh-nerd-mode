# The prompt text ships with the package, not the profile config

Status: accepted, 2026-11-01. Follows [ADR 0008](0008-study-mode-is-a-global-overlay.md).

The prompt section was a required config field. A profile patch that saved Nerd Mode settings wrote the whole effective config back, section text included, so each profile kept a frozen copy. Editing the package's `cordis.patch.yml` never reached that copy, and it refreshed only when someone pasted the text again by hand.

The text now lives in `assets/section.md`. `section` stays in the config as an optional override, and a missing value reads the bundled file. A profile patch can carry only the three settings it changes. Saving settings writes those three keys, never the prompt. Editing the prompt is one file edit plus a restart.

Alternatives. A sync script was rejected: it keeps two copies and adds a step to remember. Removing only the profile entry was rejected: the next settings save writes the live config back, and the copy returns.
