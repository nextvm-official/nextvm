# Tick System

> 1

NextVM ships a managed tick scheduler that replaces raw `setTick()`.
Modules register their tick handlers via `ctx.onTick(handler, opts)`,
and the framework runs them on a single frame loop with priority-based
budget control.

## Why managed ticks?

Raw `setTick()` is dangerous in three ways:

1. **No budget enforcement.** Twenty modules each running a 5ms tick
   blow the frame budget without anyone noticing.
2. **No error isolation.** A single throw kills the loop forever.
3. **No coordination.** Two modules running expensive ticks at the
   same time will compete for CPU.

`TickScheduler` fixes all three.

## Registering ticks

```typescript
ctx.onTick(
  () => {
    // Frame work for this module
    syncEntities()
  },
  {
    interval: 100,         // ms between calls (default 0 = every frame)
    priority: 'MEDIUM',    // HIGH | MEDIUM | LOW
  },
)
```

| Priority | Behavior |
|---|---|
| `HIGH` | Always runs when its interval elapses |
| `MEDIUM` | Skipped if remaining frame budget is < 5ms |
| `LOW` | Skipped if remaining frame budget is < 10ms |

This means HIGH ticks (player input, security checks) always run.
LOW ticks (background entity sync, garbage collection) get pushed
back when the frame is busy.

## How the budget works

Each frame the scheduler:

1. Resets a `wallStart = Date.now()`
2. Iterates through every registered tick
3. For each tick: checks the interval gate (logical time), checks
   degradation, then checks the budget gate (real CPU time)
4. Runs the tick wrapped by the ErrorBoundary
5. Records the duration in the profiler under `tick:<module>:onTick`
6. Returns a `FrameStats` summary (executed, skipped*, totalMs)

The budget gate uses **real wall-clock time** so it correctly throttles
under load. The interval gate uses **logical time** (the `now` you pass
in) so tests are deterministic.

## Two clocks, one scheduler

```typescript
// In the FiveM runtime, this is called from a single setTick() loop:
setTick(() => loader.getTickScheduler().runFrame())

// In tests, you control the clock:
await scheduler.runFrame(0)      // first frame at logical time 0
await scheduler.runFrame(1500)   // second frame at logical time 1500
```

Logical time drives the per-tick `interval` gate. Wall-clock drives the
budget gate. Tests can advance logical time without dealing with real
CPU timing.

## Auto-degradation

When the [ErrorBoundary](/concept/error-boundaries) marks a module as
degraded, the tick scheduler automatically skips that module's ticks.
Skipped degraded ticks are counted in `FrameStats.skippedDegraded`.
The module stays degraded until an admin re-enables it via
`errorBoundary.reEnable(module)`.

## Profiler integration

Every executed tick records its duration in the built-in
[`Profiler`](/concept/error-boundaries#profiler) under the key
`tick:<module>:onTick`. You can read the aggregated stats via:

```typescript
const profiler = loader.getProfiler()
const stats = profiler.getStats('tick', 'banking', 'onTick')
// → { count, avg, p50, p95, p99, max, min }
```

The CLI command `nextvm perf` will surface this in .

## ModuleLoader integration

The ModuleLoader pre-wires the scheduler for you:

```typescript
constructor() {
  this.tickScheduler.setErrorBoundary(this.errorBoundary)
  this.tickScheduler.setProfiler(this.profiler)
}
```

So when your module's `server()` calls `ctx.onTick(...)`, the handler
is automatically:

- Registered with the shared `TickScheduler`
- Wrapped by the `ErrorBoundary`
- Profiled

You don't have to think about any of this — just call `ctx.onTick`.

## Escape hatch: createBatchProcessor

For work that needs to be **spread across many ticks** (e.g. syncing
1000 entities at 50/frame), `@nextvm/natives` ships
[`createBatchProcessor`](/packages/natives#createbatchprocessor):

```typescript
import { createBatchProcessor } from '@nextvm/natives'

const batch = createBatchProcessor({
  chunkSize: 50,
  worker: (entity) => syncEntity(entity),
})

ctx.onTick(async () => {
  if (batch.done()) batch.fill(getAllEntities())
  await batch.tick()
}, { interval: 100, priority: 'LOW' })
```

This pattern is the [](/reference/pla)
escape hatch for spreading entity work safely.

## See also

- [Error Boundaries](/concept/error-boundaries)
- [`@nextvm/core` TickScheduler](/packages/core)
- [`@nextvm/natives` createBatchProcessor](/packages/natives)
