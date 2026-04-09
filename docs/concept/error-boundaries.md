# Error Boundaries

> Concept v2.3, Chapter 22.2

NextVM wraps every module's lifecycle hooks, tick handlers, event
handlers, and RPC handlers in an error boundary. The goal is hard:
**a crashing module must not take down the server or other modules**.

## How it works

The framework instantiates an `ErrorBoundary` and an `ErrorCounter` at
ModuleLoader construction time. Every catchable surface in the
framework reports errors into them:

- `ModuleLoader` wraps lifecycle hooks via `safeCall(...)`
- `EventBus` reports thrown handler errors via `setErrorReporter(...)`
- `RpcRouter` reports thrown handler errors via `setErrorReporter(...)`
- `TickScheduler` wraps tick handlers via `errorBoundary.wrapAsync(...)`

When a handler throws:

1. The error is logged with full module + handler + stack context
2. The error count for that module increases
3. If the rolling-window count exceeds the threshold (default 10/min),
   the module is marked **degraded**
4. A `module:degraded` event is emitted on the bus
5. The module's tick handlers stop running until `reEnable(module)` is
   called

## ErrorCounter

```typescript
import { ErrorCounter } from '@nextvm/core'

const counter = new ErrorCounter(
  10,        // threshold: errors per window
  60_000,    // window in ms (default 60s)
)

const justDegraded = counter.record('banking', {
  origin: 'tick',
  handler: 'syncEntities',
  message: 'cannot read undefined',
  timestamp: Date.now(),
})

if (justDegraded) {
  console.log('banking is now degraded')
}

counter.isDegraded('banking')      // true
counter.reEnable('banking')         // back to healthy
```

The counter uses a rolling window: errors older than `windowMs` are
dropped on every record call. Brief error spikes that recover don't
trip the threshold.

## ErrorBoundary

```typescript
import { ErrorBoundary } from '@nextvm/core'

const boundary = new ErrorBoundary(counter, eventBus)

// Wrap an async handler
await boundary.wrapAsync('banking', 'tick', 'sync', async () => {
  await syncEntities()
})

// Or wrap a sync one
boundary.wrap('banking', 'event-handler', 'onTransaction', () => {
  doStuff()
})

// Or report manually
boundary.report('banking', 'rpc-handler', 'transfer', err)

// Check + manually re-enable
if (boundary.isDegraded('banking')) {
  boundary.reEnable('banking')
}
```

## Origins

The `origin` field categorizes where the error came from:

| Origin | Source |
|---|---|
| `lifecycle` | A `ctx.on*` handler thrown during init/ready/stop |
| `tick` | A registered tick handler |
| `event-handler` | A handler subscribed via `ctx.events.on` |
| `rpc-handler` | An RPC procedure handler |
| `state-subscriber` | A state store `subscribe()` callback |

The CLI's `nextvm perf` command (Phase 3) groups errors by origin so
you can see at a glance which subsystem is misbehaving.

## module:degraded event

When a module just degraded, the bus fires:

```typescript
ctx.events.on('module:degraded', (status) => {
  // status: { module, errorCount, lastError, degradedAt }
  notifyAdmins(`Module ${status.module} is degraded — ${status.errorCount} errors in the last minute`)
})
```

The Discord integration uses this for ops alerts:

```typescript
discord.autoLog({
  'module:degraded': 'logs',
})
```

## Re-enabling a module

Once an admin has investigated and fixed whatever was wrong, the
module can be re-enabled. There's no automatic recovery — that's
deliberate, because most degradation root causes survive a single
tick window.

```typescript
errorBoundary.reEnable('banking')
// → emits 'module:recovered' on the bus
// → tick scheduler stops skipping the module's ticks
```

A future admin module / web dashboard will surface this as a "restart
module" button. For Phase 2 it's a programmatic call from the
bootstrap or an exec'd command.

## Why not catch + retry automatically?

Two reasons:

1. **Most errors are deterministic.** A stack overflow caused by
   a bad config doesn't fix itself by retrying — it just keeps
   crashing.
2. **Auto-retry hides bugs.** If a module silently keeps recovering
   from the same error, the underlying bug never gets fixed.

The threshold + manual re-enable model is loud about failure
without taking down the server.

## See also

- [Tick System](/concept/tick-system)
- [`@nextvm/core` errors API](/packages/core)
- [Concept v2.3 Chapter 22.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
