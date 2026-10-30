# 01 — Register the Lectures dock page

Status: ready-for-agent
Blocked by: none

## Question

Ship the seat for the panel: one dock tab type of kind `lectures`, one guide entry that puts its card on the Start page, and one page body registered in the keyed dock pane slot under the same id. Prove the seat works in the installed host before any list code exists.

## Scope

Read the spec at `.scratch/study-lecture-library/spec.md`, sections **Seat**, **Manifest**, and Further Notes paragraph 1.

1. Verify the host surfaces named in Further Notes against the installed host, not against memory. The notes from recon are at `.scratch/study-lecture-library/host-api.md`. Confirm three things, and record the answer in `## Answer`:
   - the tab registry accepts a page kind that names no resource pattern;
   - a guide entry renders with an icon and a title;
   - a dock pane body can reach the session on screen and open a resource.
2. Register the tab type. `id` is the implementation identity and is also the key for the body and title registrations. `kind` is `lectures`.
3. Register the body at the dock pane slot, keyed by the same id. Exclude nothing else; the body in this ticket renders one placeholder line.
4. Register the guide entry so the Start page holds one Lectures card.
5. Make the page single-instance: a second open focuses the tab that already exists.
6. Add one row to the `dsh.client.inject` list in `package.json` only if the host requires a declaration to deliver the dock registry. Name the row in the Answer either way. The host half and `cordis.patch.yml` stay untouched.
7. Wait for the registry through the plugin's service injection, so a host that lacks the dock shows nothing and does not throw.

## Fallback

If the installed host has no dock registry, stop and write the finding in `## Answer` before writing code. The fallback seat is a conversation view tab beside the existing Study tab, with the same list and the same preview call. Do not build the fallback in this ticket without saying so first.

## Tests

Extend `test/client.test.mjs` through the existing mount helper. Assert exactly:

- one dock tab type with kind `lectures`;
- one guide entry;
- one body registration under the same key as the tab type.

Do not assert on style values.

## Acceptance

- `npm test` passes.
- `npm run lint` passes.
- The Answer records each verified host surface with the evidence that proved it.

## Validation owner

The implementer runs `npm test` and `npm run lint`. The merger checks that `client.inject` in `test/client.test.mjs` still matches the manifest.
