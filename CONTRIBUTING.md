# Contributing to NextVM

Thanks for your interest in NextVM! This document explains how the
project is organised and what to expect when you open an issue or PR.

## Quick start

```bash
git clone https://github.com/nextvm-official/nextvm
cd nextvm
pnpm install
pnpm build
pnpm test
```

You need **Node 22 LTS** (pinned via `.nvmrc`) and **pnpm 9+**.

## Project layout

- `packages/*` — framework packages (`@nextvm/*`)
- `modules/*` — first-party game modules (banking, jobs, housing, ...)
- `examples/*` — reference projects, see `examples/full-stack`
- `docs/` — VitePress source for the docs site

## Workflow

1. Open an issue first if your change is non-trivial — it's nicer for
   everyone to agree on the approach before code is written.
2. Fork, branch from `main`, keep PRs focused.
3. Run `pnpm validate` (architecture guards) and `pnpm test` locally.
4. Add a changeset for any user-facing change:
   ```bash
   pnpm changeset
   ```
5. Open the PR. The CI runs build + test on Node 22.

## Architecture rules

A few hard rules that keep modules composable and the framework
honest:

- **No direct FiveM native calls in modules** — use `@nextvm/natives`
- **No cross-module imports** — use DI via `ctx.inject<T>()`
- **Validate every RPC input and every config** with Zod
- **Use `charId`, never `source`, for player data**
- **Stick to PLA-compliant monetization** for anything that touches
  real money — see [`SECURITY.md`](./SECURITY.md) and the docs site

`pnpm validate` runs the static checks.

## Commit message format

```
type(scope): short description

Optional longer body.
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`.

## Code style

- TypeScript strict mode, no `any`
- Tabs for indentation, single quotes, no semicolons (Biome handles it)
- Run `pnpm lint` before pushing

## Tests

Every package has its own `vitest` test suite. Tests run in single-fork
mode for stability:

```bash
pnpm test                    # all packages
pnpm --filter @nextvm/core test
```

For test patterns, see [`docs/guide/testing`](./docs/guide/testing.md).

## Documentation

If your change touches the public API, update the matching page under
`docs/packages/*` or `docs/modules/*`. Run `pnpm docs:dev` to preview.

## Reporting issues

Use the issue templates under `.github/ISSUE_TEMPLATE/`. Include:

- NextVM version (`pnpm list @nextvm/core`)
- Node version (`node --version`)
- A minimal reproduction if possible

## License

By contributing you agree that your contribution will be licensed
under the [Business Source License 1.1](./LICENSE) (BUSL-1.1), the
same license as the rest of the project. Each released version
automatically converts to Apache License 2.0 four years after release.
