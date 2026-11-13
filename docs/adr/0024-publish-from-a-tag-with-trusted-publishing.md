# Publish to npm from a version tag with trusted publishing

Status: accepted, 2026-11-13.

Pushing a `v*` tag is the only release action. The tag must name a stable
version, match the version in `package.json`, have a section in `CHANGELOG.md`,
and point at a commit that is already on `main`. The workflow refuses anything
else before it reaches npm.

The workflow reruns lint and the full test suite, then publishes. It holds no
npm credential: GitHub Actions presents its OIDC identity, npm exchanges it for
a short-lived publish token, and npm attaches a provenance statement
automatically because both the repository and the package are public. Tag
creation is limited to administrators, and that ruleset is the only gate
between a maintainer and a live version.

After the upload, the workflow creates a GitHub Release from the changelog
section. A Release failure only warns, because the version is already live and
a re-run would stop at the version check. The Release is then created by hand.

## Considered Options

An npm access token stored in the repository was rejected. It is a long-lived
credential, and anyone who reads it can publish any version. Trusted
publishing removes the secret entirely.

Publishing from a developer machine was rejected. It leaves no record of who
released what, attaches no provenance, and depends on one machine being logged
in.

Staged publishing was rejected. It adds a second confirmation in the npm
website after the workflow, which is one more step for no extra check at this
size.

A GitHub Environment with required reviewers was considered and rejected. One
maintainer pushes the tag and would approve the same run, so the approval adds
a click without a second pair of eyes. The tag ruleset already limits who can
start a release.

Publishing on every push to `main` was rejected. A version bump would go live
as soon as it merges, with no separate release action.

## Consequences

- The repository holds no long-lived npm credential.
- Provenance is automatic. It needs a public repository and a public package,
  and both hold today.
- A new trusted publisher configuration expires if its first publish does not
  happen within two days.
- Only stable versions publish. A prerelease tag fails, so the project has no
  prerelease channel.
- A published version cannot be replaced. Recovery is a deprecation notice and
  a patch, with `npm unpublish` reserved for the 72-hour window and a broken
  package.
- The workflow file must exist in the tagged commit, so the workflow lands
  before the first tag it publishes.
- A failed GitHub Release does not fail the run. It is created by hand.
