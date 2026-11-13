# Releasing

One tag push publishes one version. The `publish` workflow checks the commit,
runs the test suite, publishes to npm, and creates a GitHub Release.

## One-time setup

### npm trusted publisher

On [npmjs.com](https://www.npmjs.com) open the `dsh-nerd-mode` package, then
Settings → Trusted publishing → Add trusted publisher → GitHub Actions:

- Organization or user: `bocchii-the-code`
- Repository: `dsh-nerd-mode`
- Workflow filename: `publish.yml` (the filename only, with the extension)
- Environment name: leave empty
- Allowed actions: enable `npm publish`

The filename, the repository, and the account must match exactly. A mismatch
fails only at publish time, with `ENEEDAUTH`.

A new configuration must complete its first publish within two days. After
that it expires and must be deleted and created again.

### Tag ruleset

Create a repository ruleset for tags that matches `v*` and allows only
administrators to create a tag. Without it, anyone with write access can start
a publish.

## Release a version

1. In one commit, set the version in `package.json`, add the `## [<version>]`
   section to `CHANGELOG.md`, and update both skill descriptions. The
   consistency test fails when the three disagree.
2. Run `npm run check` and fix every failure.
3. Push `main`.
4. Tag the commit that is now on `main` and push the tag:

   ```bash
   git tag v0.5.2
   git push origin v0.5.2
   ```

5. Watch the `publish` run under Actions.
6. Verify the result:

   ```bash
   npm view dsh-nerd-mode version
   gh release view v0.5.2
   ```

   The version must be the new one, and the Release must carry the changelog
   section.

## What the workflow refuses

The run stops before publishing when:

- the tag is not `v<major>.<minor>.<patch>`, so `v0.6.0-beta.1` fails;
- the tag does not match the version in `package.json`;
- `CHANGELOG.md` has no section for the version;
- the tagged commit is not part of `main`;
- npm already has that version;
- lint or a test fails.

Prereleases have no channel. Publish a stable version when the code is ready.

## When a step fails

| Failure | What to do |
| --- | --- |
| Tag format, version mismatch, or missing changelog | Fix the commit, push `main`, delete the tag, and tag again. Nothing was published. |
| Tag is not on `main` | Merge the commit into `main` first. |
| Version already on npm | Bump the patch version. A published version cannot be replaced. |
| Lint or test failure | Fix it on `main`, then move the tag. Nothing was published. |
| `ENEEDAUTH` during publish | Compare the trusted publisher fields with this document. The workflow filename and the repository are case-sensitive. |
| GitHub Release missing | Create it by hand: `gh release create v0.5.2 --title v0.5.2 --notes-file <file>`. Re-running the workflow stops at the version check. |

## Rollback

A published version stays published. To warn users, deprecate it and publish a
patch:

```bash
npm deprecate dsh-nerd-mode@0.5.2 "Broken update check; use 0.5.3."
```

`npm unpublish` works for 72 hours and interrupts every install that resolves
the version. Use it only when the package leaks a secret or is unusable, and
publish a new version afterwards.

Deleting and re-creating a git tag does not change what npm has. The tag is a
trigger, not the artifact.

## Limits

- No prerelease channel, no staged publishing, no approval environment.
- No npm token is stored in the repository. The workflow authenticates with
  GitHub OIDC, so provenance is attached automatically.
- The workflow file must exist in the tagged commit. Land the workflow on
  `main` before the first tag.
