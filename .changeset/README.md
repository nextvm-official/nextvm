# Changesets

This directory contains [changesets](https://github.com/changesets/changesets) —
small Markdown files that describe a single user-facing change.
Changesets are accumulated as PRs land on `main` and consumed when a
new release is cut.

## Adding a changeset

```bash
pnpm changeset
```

The CLI walks you through:

1. Pick the affected packages
2. Pick the bump type (patch / minor / major)
3. Write a one-line summary of the change

It writes a new `.changeset/<random-name>.md`. Commit it with your PR.

## Releasing

When the maintainers want to cut a release:

```bash
pnpm changeset version    # consume changesets, bump versions, update CHANGELOG.md
pnpm changeset publish    # publish to npm
```

The release workflow under `.github/workflows/release.yml` automates
this on the public repo: when a `Version Packages` PR opened by the
changesets bot is merged, every changed package is published to npm.

## Why?

- Single source of truth for what's in the next release
- Lets us batch many small fixes into one release without losing the
  per-fix changelog entry
- Forces every contributor to think about whether their change is a
  patch, minor, or major bump
