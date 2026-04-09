# Architecture Guards

NextVM enforces 13 architecture guards. These are hard rules — `nextvm validate`
fails the build if any are violated. They exist because every one of them
maps to a class of bug that has bitten production FiveM servers before.

| ID | Guard | Why |
|---|---|---|
| GUARD-001 | No direct FiveM native calls in modules — use `@nextvm/natives` | Native API churn, testability, type safety |
| GUARD-002 | No cross-module imports — use DI / event bus | Decoupling, hot reload, testability |
| GUARD-003 | Server-authoritative for money, inventory, permissions | Anti-cheat |
| GUARD-004 | No `TriggerServerEvent` — use typed RPC | Validation, rate limiting, types |
| GUARD-005 | All RPC inputs + configs validated with Zod | Defense in depth |
| GUARD-006 | No global mutable state — use `defineState` | Hot reload, character switching |
| GUARD-007 | No synchronous DB in tick handlers | Frame budget |
| GUARD-008 | Layer N may only import from layer N-1 | Architecture clarity |
| GUARD-009 | State schemas must use `.describe()` for every field | Discoverability, migrations |
| GUARD-010 | Use `charId`, never `source`, for player data | Source recycling, multi-character |
| GUARD-011 | All user-facing strings via i18n | Localization |
| GUARD-012 | PLA-compliant payment flow only | Cfx.re Platform License Agreement |
| GUARD-013 | No `ctx as unknown` casts — use `defineExports()` + `ctx.setExports()` | Type safety, DX |

## How they're enforced

- **Static checks** — `nextvm validate` runs Biome rules + custom AST checks
- **Build pipeline** — `nextvm build` re-runs validate as a precondition
- **CI** — the framework's own GitHub Actions run validate on every PR
- **Tests** — many guards have dedicated test suites in `packages/*/test/`

## When a guard fires

The validate command prints the file, line, and a hint:

```
✗ GUARD-002 cross-module import
  modules/banking/src/server/payroll.ts:4
  → import { getJob } from '../../jobs/src/server/api';
  → use ctx.inject<JobsAdapter>('jobs') instead
```

## See also

- [`.ai/GUARDS.md`](https://github.com/nextvm-official/nextvm/tree/main/docs) — full source of truth
- [Module Authoring](/guide/module-authoring)
