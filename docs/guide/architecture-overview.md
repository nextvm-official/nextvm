# Architecture Overview

NextVM follows a strict five-layer architecture. Each layer may only
depend on the layer directly below it. Cross-layer-up imports are
forbidden by [GUARD-008](/reference/guards#guard-008-layer-boundaries).

## The five layers

```
┌────────────────────────────────────────────┐
│ Layer 5  Content              modules/*    │   premium / community
├────────────────────────────────────────────┤
│ Layer 4  Game Modules         modules/*    │   first-party + community
├────────────────────────────────────────────┤
│ Layer 3  Core Framework       packages/*   │   module system, RPC, state, ...
├────────────────────────────────────────────┤
│ Layer 2  Native Wrappers      @nextvm/natives
├────────────────────────────────────────────┤
│ Layer 1  Runtime              CitizenFX V8 + Node 22
└────────────────────────────────────────────┘
```

| Layer | Responsibility | Examples |
|---|---|---|
| 1 — Runtime | The CitizenFX V8 client + Node.js 22 server | not part of NextVM |
| 2 — Natives | Typed wrappers around FiveM natives | `NextVMPlayer.setPosition()` instead of `SetEntityCoords(handle, x, y, z, ...)` |
| 3 — Core | Module system, DI, RPC, state, i18n, logging, build | `defineModule`, `defineRouter`, `defineState`, `Database`, `RpcRouter` |
| 4 — Modules | Game modules with one domain each | `@nextvm/banking`, `@nextvm/jobs`, your custom modules |
| 5 — Content | Premium / community modules from the marketplace | `@nextvm-community/loans` |

## Why the layers matter

- **Layer 4 modules cannot call FiveM natives directly.** They must go
  through `@nextvm/natives` (GUARD-001). This means a module can be unit
  tested in plain Node.js — the natives are abstracted behind interfaces.
- **Layer 4 modules cannot import each other directly.** Cross-module
  communication goes through DI (`ctx.inject`) or events (`ctx.events`)
  (GUARD-002).
- **Money/inventory/permission writes are server-side only.** The
  server is authoritative; the client never decides what it receives
  (GUARD-003).
- **The build pipeline enforces all of this.** `nextvm validate` and
  `nextvm build` catch the common violations before they hit production.

## Core principles

NextVM is built on eight core principles documented in
[Concept v2.3 Chapter 5.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept):

### 1. Dependency Inversion
Modules depend on **abstractions**, never on concrete FiveM natives.
The natives layer is the only place where raw natives are called.

### 2. Single Responsibility
Each module owns one domain. Cross-cutting concerns (logging, error
handling, character lifecycle) are handled by the framework core.

### 3. Event-Driven
Inter-module communication goes through the **typed event bus**, never
through direct imports. The Banking module emits `banking:transaction`;
the audit module subscribes — neither knows about the other.

### 4. Config-as-Code
Module config is a **Zod schema** validated at startup. Misconfiguration
fails loudly. The same schema generates dashboard UI in the SaaS layer.

### 5. Zero Global State
All state goes through the framework's state management system.
Module-level mutable globals are forbidden (GUARD-006). Services hold
their state on instance fields.

### 6. Build-Time Safety
TypeScript + Zod + the CLI's `validate` step catch errors before the
server starts. Missing locales, missing input schemas, missing
MONETIZATION.md for monetized modules — all flagged at build time.

### 7. Schema-Driven
Zod schemas are the **single source of truth** for runtime validation,
TypeScript types, dashboard widgets, documentation, and i18n key
enforcement.

### 8. PLA-Aware
Modules that touch player monetization are flagged and require Tebex
integration via `@nextvm/tebex`. NextVM never processes payments
directly — the [Cfx.re Creator PLA](/reference/pla) doesn't allow it.

## Inside a module

A NextVM module is a small layered application of its own:

```
modules/banking/
├── src/
│   ├── index.ts                # Wiring (defineModule + setExports)
│   ├── server/
│   │   ├── service.ts          # Domain logic (pure TypeScript)
│   │   └── router.ts           # RPC boundary (Zod validation)
│   ├── client/index.ts
│   ├── shared/
│   │   ├── schemas.ts          # Zod types shared between server + client
│   │   ├── constants.ts        # Event names, ACE permission strings
│   │   └── locales/{en,de}.ts
│   └── adapters/
│       └── banking-adapter.ts  # Interface OTHER modules import to consume us
├── __tests__/
│   ├── service.test.ts
│   └── router.test.ts
└── package.json
```

The full convention is documented in [Module Authoring](/guide/module-authoring).

## Cross-module communication

There are three patterns:

| Pattern | When to use | Example |
|---|---|---|
| **Service injection** (DI) | Sync typed call to another module | jobs needs `banking.addMoney()` |
| **Typed events** | Fan-out, multiple consumers | banking emits `banking:tx`, audit + analytics + anti-cheat all subscribe |
| **Shared state** | UI binding, derived state | NUI subscribes to `playerState.cash` and re-renders on change |

The DI path uses **adapter interfaces** defined in the consuming
module — the producer doesn't need to know who its consumers are.

## How requests flow

A typical RPC call from the client to the server:

```
client                         server
  │                              │
  ├── nextvm.rpc.banking ────────▶
  │     .transfer({...})         │
  │                              ├── RpcRouter.dispatch()
  │                              │
  │                              ├── 1. Rate limit (per player)
  │                              ├── 2. Decrypt (if AC encryption set)
  │                              ├── 3. Zod validate input
  │                              ├── 4. Build typed ctx (source, charId)
  │                              ├── 5. Run .auth() middleware
  │                              ├── 6. Profile + run handler
  │                              │     (wrapped by ErrorBoundary)
  │                              │
  ◀──── { ok: true, txId: 42 } ──┤
  │                              │
```

If the handler throws, the ErrorBoundary records it on the module's
error counter. If the counter exceeds the threshold (default 10/min),
the module is marked **degraded** — its tick handlers stop running and
its event handlers stop being invoked until an admin re-enables it.

## Where the framework lives

```
NextVM repository
├── packages/                   # @nextvm/* framework packages
│   ├── core/                   # Layer 3 — module system, RPC, state, ...
│   ├── natives/                # Layer 2 — typed FiveM wrappers
│   ├── db/                     # Layer 3 — typed query builder + MySQL
│   ├── i18n/                   # Layer 3 — typed translation keys
│   ├── test-utils/             # Layer 3 — mocks + harness for tests
│   ├── build/                  # Layer 3 — project loader + tsup orchestration
│   ├── cli/                    # Layer 3 — nextvm command-line tool
│   ├── discord/                # Layer 3 — Discord bot integration
│   ├── compat/                 # Layer 3 — ESX/QBCore compat exports
│   ├── tebex/                  # Layer 3 — PLA-compliant payment bridge
│   ├── registry/               # Layer 3 — marketplace client
│   └── migration/              # Layer 3 — ESX/QBCore migration toolkit
├── modules/                    # Layer 4 — first-party game modules
│   ├── player/
│   ├── vehicle/
│   ├── inventory/
│   ├── banking/
│   ├── jobs/
│   └── housing/
├── recipes/                    # txAdmin one-click install recipe
├── scripts/                    # Maintenance + demo bundling
└── docs/                       # This site
```

## Next reading

- [Module Authoring](/guide/module-authoring) — the prescriptive guide
- [Concept Overview](/concept/) — chapter-by-chapter framework spec
- [Architecture Guards](/reference/guards) — the 13 hard rules
