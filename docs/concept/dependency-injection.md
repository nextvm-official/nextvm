# Dependency Injection

> Concept v2.3, Chapter 8.2

NextVM modules **never import each other directly**. Cross-module
communication goes through the typed DI container or the typed event
bus. This is enforced by [GUARD-002](/reference/guards#guard-002-no-cross-module-imports).

## Why DI?

Direct cross-module imports cause:

- **Tight coupling** — refactoring one module breaks others
- **Testing pain** — every test has to spin up the producer
- **Hidden dependency graphs** — there's no central place to ask
  "what modules does X need?"

NextVM solves this with a topologically resolved DI container plus the
**adapter pattern** for the typed contracts.

## The adapter pattern

The adapter is the heart of the pattern: **the consumer defines the
shape it needs, not the producer**.

### Consumer side

```typescript
// modules/jobs/src/adapters/banking-adapter.ts
//
// Defining the contract here (instead of importing the producer
// directly) keeps the dependency loose, satisfies GUARD-002, and
// makes the jobs service trivially testable with a stub.

export interface BankingAdapter {
  addMoney(
    charId: number,
    type: 'cash' | 'bank',
    amount: number,
    reason?: string,
  ): Promise<number>
}
```

```typescript
// modules/jobs/src/index.ts
import type { BankingAdapter } from './adapters/banking-adapter'

server: (ctx) => {
  const banking = ctx.inject<BankingAdapter>('banking')
  service.setBanking(banking)
}
```

### Producer side

```typescript
// modules/banking/src/index.ts
import { defineExports } from '@nextvm/core'

export type BankingExports = ReturnType<typeof buildExports>

function buildExports(service: BankingService) {
  return defineExports({
    service,
    addMoney: service.addMoney.bind(service),
    // ...
  })
}

server: (ctx) => {
  ctx.setExports(buildExports(service))
}
```

The producer **does not know** about the `BankingAdapter` interface.
It just publishes its full surface. The consumer picks the methods it
cares about and types them locally.

This is **interface segregation** (the I in SOLID): the consumer
depends only on the methods it actually uses.

## Topological resolution

When you write `dependencies: ['banking']` on a module's
`defineModule`, the framework's `DIContainer`:

1. Records the edge `jobs → banking`
2. Runs a topological sort over all registered modules
3. Detects cycles and throws with the dependency chain
4. Initializes modules in the resolved order

So when jobs's `server()` runs, banking has already published its
exports — `ctx.inject('banking')` returns immediately.

```typescript
const c = new DIContainer()
c.register(defineModule({ name: 'banking', ... }))
c.register(defineModule({ name: 'jobs', dependencies: ['banking'], ... }))

const order = c.resolveDependencyOrder()
// → ['banking', 'jobs']
```

If you forgot to register a dependency, you get a clear error:

```
Module 'jobs' depends on 'banking', but 'banking' is not registered.
Available modules: jobs, player, housing
```

If there's a cycle:

```
Circular dependency detected: jobs → banking → jobs
```

## Three patterns for cross-module communication

| Pattern | When | Example |
|---|---|---|
| **DI / inject** | Sync typed call, response needed | `jobs.paySalaries()` calls `banking.addMoney()` |
| **Typed events** | Fan-out, multiple consumers | `banking:transaction` → audit + analytics + anti-cheat |
| **Shared state** | Watch + react, derived state | `playerState.cash` change → NUI re-render |

Use DI when the consumer needs a typed function call and wants the
return value. Use events when you don't care who's listening. Use
shared state when you need reactive data flow.

## Why no DI decorators?

NextVM doesn't use class decorators (`@Inject`, `@Injectable`, ...).
Reasons:

1. They require `experimentalDecorators` and runtime metadata
2. They obscure the dependency graph at the call site
3. They're hard to type correctly without `reflect-metadata`

The explicit `ctx.inject<T>('module')` call is uglier but more
honest: you can grep for it, the type comes from the consumer's own
adapter file, and there's no hidden runtime magic.

## Testing with DI

For tests, use `createMockContext({ injections })`:

```typescript
import { createMockContext } from '@nextvm/test-utils'
import { vi } from 'vitest'

const banking = {
  addMoney: vi.fn(async () => 100),
}

const ctx = createMockContext({
  name: 'jobs',
  config: { salaryIntervalMinutes: 10 },
  injections: { banking },
})

// Now ctx.inject('banking') returns the mock
```

If your module calls `ctx.inject('banking')` and you forgot to mock
it, the mock context throws a clear error:

```
inject('banking') has no mock binding. Pass it via createMockContext({ injections: { banking: ... } })
```

## See also

- [Module System](/concept/module-system)
- [`DIContainer` in @nextvm/core](/packages/core)
- [Module Authoring guide — Cross-Module Communication](/guide/module-authoring#4-cross-module-communication-three-patterns)
