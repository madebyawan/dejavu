# Releasing

Déjà Vu follows [Semantic Versioning](https://semver.org/). Until 1.0.0, minor versions may include breaking changes. Changes are recorded in [CHANGELOG.md](../CHANGELOG.md) under `## [Unreleased]` as they merge.

## Cutting a release

1. Move the `Unreleased` entries into a new `## [X.Y.Z] - YYYY-MM-DD` section.
2. Set `"version": "X.Y.Z"` in `package.json`.
3. Merge to `main`, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The [release workflow](../.github/workflows/release.yml) runs the tests, checks that the tag matches `package.json`, and creates a GitHub release with the changelog section and the packed tarball.

Users can install a release without npm: `npm install https://github.com/madebyawan/dejavu/releases/download/vX.Y.Z/<tarball>.tgz`.

## npm publishing (not enabled)

The package is `"private": true` and nothing publishes to npm. Before that changes, a maintainer must:

- Choose an available name. `dejavu` and `dejavu-cli` are taken on npm; a scoped name such as `@madebyawan/dejavu` needs an npm organization.
- Confirm the shipped commands work on real repositories.
- Remove `"private": true`, and add an `npm publish --provenance` step with an `NPM_TOKEN` secret.

## CI

[CI](../.github/workflows/ci.yml) runs `npm test` on Node 22 and 24 across Linux, macOS, and Windows. It also installs the packed tarball into a sample project and runs `init` twice and `check` through `npm exec`.
