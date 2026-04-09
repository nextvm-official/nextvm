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

NextVM enforces 13 architecture guards. They live in
[`docs/reference/guards.md`](./docs/reference/guards.md). The most
important ones:

- **GUARD-001** — no direct FiveM native calls in modules
  (use `@nextvm/natives`)
- **GUARD-002** — no cross-module imports
  (use DI via `ctx.inject<T>()`)
- **GUARD-005** — every RPC input + every config validated with Zod
- **GUARD-010** — use `charId`, never `source`, for player data
- **GUARD-012** — PLA-compliant payment flow only

`pnpm validate` runs all 13 as a hard check.

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

By contributing you agree that your contribution will be licensed under
LGPL-3.0, the same license as the rest of the project.
