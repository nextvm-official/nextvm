# Module System

> 

A NextVM **module** is the unit of functionality. One module owns one
domain (banking, jobs, housing, mailbox, ...). Modules never import
each other directly — they communicate through the typed event bus
or via dependency injection.

## defineModule

Every module exports a single `defineModule()` call as its default
export. This is the **wiring file** — it should be one screen long
and contain no domain logic.

```typescript
import { defineExports, defineModule, z } from '@nextvm/core'
import { buildBankingRouter } from './server/router'
import { BankingService } from './server/service'

export type BankingExports = ReturnType<typeof buildExports>
const buildExports = (s: BankingService) => defineExports({
  service: s,
  transfer: s.transfer.bind(s),
})

export default defineModule({
  name: 'banking',
  version: '0.1.0',
  dependencies: ['player'],

  config: z.object({
    startingCash: z.number().int().min(0).default(500)
      .describe('Cash given on first spawn'),
  }),

  server: (ctx) => {
    const service = new BankingService()
    const router = buildBankingRouter(service)
    ctx.setExports(buildExports(service))
    ctx.log.info('banking ready', {
      procedures: Object.keys(router).length,
    })
  },

  client: (ctx) => {
    ctx.log.info('banking client loaded')
  },
})
```

## Lifecycle hooks

The framework calls into your module at well-defined points. There
are **9 lifecycle hooks**:

| Hook | Side | Fires when |
|---|---|---|
| `onModuleInit` | both | Module loaded, dependencies resolved |
| `onModuleReady` | both | Every module is initialized, server is accepting players |
| `onPlayerConnecting` | server | Player is connecting (can defer/reject) |
| `onPlayerReady` | server | Player fully loaded, character selected, data available |
| `onPlayerDropped` | server | Player disconnected |
| `onMounted` | client | Local player spawned, framework ready |
| `onTick` | client | Managed tick with interval + priority |
| `onBucketChange` | both | Player moved to a different routing bucket |
| `onModuleStop` | both | Resource is stopping (cleanup) |

You attach a hook by calling `ctx.<hookName>()` from inside `server` or
`client`:

```typescript
server: (ctx) => {
  ctx.onPlayerReady(async (player) => {
    const charId = player.character.id
    service.seed(charId, { cash: 500, bank: 2500 })
  })

  ctx.onPlayerDropped(async (player) => {
    service.flush(player.character.id)
  })
}
```

## Config validation

The `config` field is a Zod object schema. NextVM validates it at
startup against the user's `nextvm.config.ts`. Failures fail loud.

```typescript
config: z.object({
  maxAccounts: z.number().int().min(1).max(10).default(3)
    .describe('Maximum bank accounts per character'),
  enableInterest: z.boolean().default(false)
    .describe('Enable monthly interest accrual'),
})
```

The `.describe()` calls power the SaaS dashboard's auto-generated
config UI and `nextvm docs` output.

## Dependencies

`dependencies: ['player', 'banking']` tells the DI container that
this module needs `player` and `banking` to be initialized first.
The container does a topological sort and detects cycles.

The actual cross-module call goes through `ctx.inject<T>('banking')`
inside the consuming module's `server()`:

```typescript
server: (ctx) => {
  const banking = ctx.inject<BankingAdapter>('banking')
  service.setBanking(banking)
}
```

`BankingAdapter` is an interface defined in the **consumer** module
(`modules/jobs/src/adapters/banking-adapter.ts`), not in the producer.
This is the  escape hatch — see [Dependency Injection](/concept/dependency-injection).

## setExports — publishing the public surface

To let other modules consume yours, publish a typed export object:

```typescript
import { defineExports } from '@nextvm/core'

export type BankingExports = ReturnType<typeof buildExports>

function buildExports(service: BankingService) {
  return defineExports({
    service,
    addMoney: service.addMoney.bind(service),
    removeMoney: service.removeMoney.bind(service),
    transfer: service.transfer.bind(service),
  })
}

server: (ctx) => {
  const service = new BankingService()
  ctx.setExports(buildExports(service))
}
```

`defineExports` is a typed identity function that anchors the inferred
type so the consumer can re-import it for `ctx.inject<BankingExports>()`.

## ctx.events — the typed event bus

Every module gets an event bus via `ctx.events`. Events are typed at
the call site, attributed to the emitting module for the error
boundary, and recorded by the test harness.

```typescript
// Emit
ctx.events.emit('banking:transactionCompleted', { from, to, amount })

// Subscribe
ctx.events.on('banking:transactionCompleted', (data) => {
  auditLog.record(data)
})
```

This is : typed events only — never `TriggerServerEvent`.

## ctx.log — structured logging

Every module gets a logger scoped to its name:

```typescript
ctx.log.info('Transfer completed', { from: 1, to: 2, amount: 500 })
ctx.log.warn('Rate limit approaching', { source, count: 45, limit: 50 })
ctx.log.error('Transfer failed', { error, input })
```

Output is JSON, parseable by log aggregators, and feeds into the
SaaS observability pipeline.

## See also

- [Dependency Injection](/concept/dependency-injection)
- [Module Authoring guide](/guide/module-authoring)
- [`@nextvm/core`](/packages/core)
