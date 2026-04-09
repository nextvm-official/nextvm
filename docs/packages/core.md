# @nextvm/core

The framework core. Module system, dependency injection, lifecycle
hooks, RPC, state management, permissions, error boundaries, tick
scheduler, profiler, character system, structured logging.

## Install

```bash
pnpm add @nextvm/core zod
```

## Quick API tour

```typescript
import {
  // Module system
  defineModule,
  defineExports,
  ModuleLoader,
  // RPC
  defineRouter,
  procedure,
  RpcRouter,
  RpcError,
  // State
  defineState,
  StateBagBackend,
  // Permissions
  PermissionsService,
  // Error boundaries
  ErrorBoundary,
  ErrorCounter,
  // Tick + profiler
  TickScheduler,
  Profiler,
  // Character system
  CharacterService,
  // Logging
  createLogger,
  // Re-export of Zod for module-author convenience
  z,
} from '@nextvm/core'
```

## Module System

| Symbol | Purpose | See |
|---|---|---|
| `defineModule(definition)` | Define a module's wiring | [Concept](/concept/module-system) |
| `defineExports(exports)` | Type-anchor a module's public surface | [DI](/concept/dependency-injection) |
| `ModuleLoader` | Topologically resolves and initializes modules | [Concept](/concept/module-system) |
| `DIContainer` | The DI store backing `ctx.inject()` | [Concept](/concept/dependency-injection) |

`ModuleLoader` exposes `getEventBus()`, `getTickScheduler()`,
`getProfiler()`, `getErrorBoundary()`, and `getContainer()` for the
runtime bootstrap layer to drive the frame loop and inspect state.

## RPC

| Symbol | Purpose | See |
|---|---|---|
| `defineRouter(routes)` | Build a typed router | [Concept](/concept/rpc) |
| `procedure` | Fluent builder for one procedure (`.input/.auth/.query/.mutation`) | |
| `RpcRouter` | Server-side dispatcher | |
| `createClient<T>(namespace, transport)` | Client-side typed proxy | |
| `RpcError` | Typed error with codes (`VALIDATION_ERROR`, `AUTH_ERROR`, ...) | |
| `RateLimiter` | Token-bucket rate limiter (per player + procedure) | |

## State Management

| Symbol | Purpose | See |
|---|---|---|
| `defineState(name, shape)` | Build a typed character-scoped state container | [Concept](/concept/state-management) |
| `StateStore` | The class returned by `defineState` | |
| `StateBagBackend` | Persists writes via FiveM Global State Bags | |

## Permissions

| Symbol | Purpose | See |
|---|---|---|
| `PermissionsService` | RBAC on top of FiveM ACE | [Concept](/concept/permissions) |

## Error Boundaries

| Symbol | Purpose | See |
|---|---|---|
| `ErrorBoundary` | try/catch wrapper + error counter | [Concept](/concept/error-boundaries) |
| `ErrorCounter` | Rolling-window error counter | |

## Tick + Profiler

| Symbol | Purpose | See |
|---|---|---|
| `TickScheduler` | Managed frame loop with priority + budget control | [Concept](/concept/tick-system) |
| `Profiler` | Records duration samples per (kind, module, name) | [Error Boundaries](/concept/error-boundaries) |

## Character System

| Symbol | Purpose | See |
|---|---|---|
| `CharacterService` | User + character lifecycle, sessions, switching | [Concept](/concept/character-system) |
| `CharacterRepository` | Port for the persistence layer (implemented by `@nextvm/db`) | |

## Logger

| Symbol | Purpose |
|---|---|
| `createLogger(name)` | Create a structured JSON logger scoped to a module |
| `Logger` | The class returned by `createLogger` |

## Integrations

| Symbol | Purpose | See |
|---|---|---|
| `bindTxAdmin(binder, deps)` | Wire txAdmin events into NextVM lifecycle | [`@nextvm/core/integrations/txadmin`](https://github.com/nextvm-official/nextvm/blob/main/packages/core/src/integrations/txadmin.ts) |

## Tests

`packages/core/__tests__/` contains 89 tests covering every public
class. Run them via `pnpm --filter @nextvm/core test`.
