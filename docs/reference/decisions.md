# Architecture Decision Records

Notable design decisions and the reasoning behind them. The full set
lives in [`.ai/DECISIONS.md`](https://github.com/nextvm-official/nextvm/tree/main/docs).

## ADR-001 — TypeScript first, no Lua escape hatch in modules

Modules are TypeScript-only. Lua interop happens exclusively in
`@nextvm/natives`, behind a typed wrapper. This trades a small amount of
flexibility for vastly better DX and tooling.

## ADR-002 — Monorepo with pnpm + Turborepo

Single repo, single lockfile, shared tooling. Turborepo handles caching
and ordering. `--concurrency=1` is forced because esbuild has a known
race condition on Windows when multiple instances spawn its service host.

## ADR-003 — tsup over rollup/webpack

tsup wraps esbuild with sane defaults for library output. ESM only,
`outExtension: '.js'`, externalize workspace deps. Build times measured
in milliseconds, not seconds.

## ADR-004 — Zod everywhere user input crosses a boundary

Every RPC procedure declares an input schema. Every config file is
validated at load time. The performance overhead is negligible compared
to the cost of an unvalidated bug reaching the database.

## ADR-005 — Character-scoped state, not source-scoped

`source` is a transient FiveM concept that gets recycled when a player
disconnects. `charId` is the stable identity for everything player-facing.
This is GUARD-010 and it's non-negotiable.

## ADR-006 — DI via context, not global container

Modules receive a `ctx` object with `inject<T>()` and `setExports()`.
There's no global service locator — everything is wired through the
`ModuleLoader`'s topological sort. This makes test harnesses trivial.

## ADR-007 — Adapter interface owned by the consumer

When module A needs a feature from module B, the interface (`BankingAdapter`,
`JobsAdapter`, etc.) is defined in module A, not module B. This keeps the
dependency direction explicit and lets you swap implementations.

## ADR-008 — Profiler is built-in, not optional

Real production servers need to profile under load. The profiler is wired
into `TickScheduler` and `RpcRouter` by default with near-zero overhead
when no consumer is attached.

## ADR-009 — Migration toolkit, not migration script

ESX/QBCore migration is a `@nextvm/migration` package with adapters per
source framework, exposed via `nextvm migrate:from`. Scripts rot.
Packages get tested.

## ADR-010 — Docs as a first-class deliverable

Every package, module, CLI command, and concept gets a Markdown page in
this VitePress site. If a feature isn't documented, the Phase isn't done.

## See also

- [`.ai/DECISIONS.md`](https://github.com/nextvm-official/nextvm/tree/main/docs) — full ADR log
