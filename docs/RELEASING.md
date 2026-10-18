# Releasing

Déjà Vu follows [Semantic Versioning](https://semver.org/). Until 1.0.0, minor versions may include breaking changes. Changes are recorded in [CHANGELOG.md](../CHANGELOG.md) under `## [Unreleased]` as they merge.

## Cutting a release

1. Move the `Unreleased` entries into a new `## [X.Y.Z] - YYYY-MM-DD` section.
2. Set `"version": "X.Y.Z"` in `package.json`.
3. Merge to `main`, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The [release workflow](../.github/workflows/release.yml) runs the tests, checks that the tag matches `package.json`, and creates a GitHub release with the changelog section and the packed tarball.

Users can install a release without npm: `npm install https://github.com/madebyawan/dejavu/releases/download/vX.Y.Z/dejavu-memory-X.Y.Z.tgz`.

## npm publishing

The package is published to npm as [`dejavu-memory`](https://www.npmjs.com/package/dejavu-memory); the executable is `dejavu`. After the tag's GitHub release succeeds, a maintainer logged in to npm publishes from a clean checkout of the tag:

```sh
git checkout vX.Y.Z
npm publish   # prepublishOnly runs npm test first
```

Publishing from CI with `npm publish --provenance` and an `NPM_TOKEN` secret is a possible follow-up.

## CI

[CI](../.github/workflows/ci.yml) runs `npm test` on Node 22 and 24 across Linux, macOS, and Windows. It also installs the packed tarball into a sample project and runs `init` twice and `check` through `npm exec`.
