# @nextvm/test-utils

Mocks and testing harness for NextVM modules. Designed so every
module surface — service, router, lifecycle, DI — can be exercised
in plain Vitest with no FXServer dependency.

## Install

```bash
pnpm add -D @nextvm/test-utils
```

## createMockContext

A complete `ModuleContext` with a recording event bus, recording
logger, lifecycle handler buckets, and DI injections:

```typescript
import { createMockContext } from '@nextvm/test-utils'

const ctx = createMockContext({
  name: 'banking',
  config: { startingCash: 500 },
  charId: 1,
  injections: {
    player: { /* mock player module exports */ },
  },
})

// Inspect what the module under test did:
ctx.harness.events.expectEmitted('banking:transactionCompleted')
ctx.harness.log.expectMessage('transfer completed')
ctx.harness.lifecycle.onPlayerReady // → handlers registered

// Trigger lifecycle hooks:
await ctx.harness.fireOnPlayerReady({
  source: 1,
  user: { id: 1 },
  character: { id: 1 },
})
```

## createMockEventBus

Recording event bus with assertion helpers:

```typescript
const bus = createMockEventBus()
bus.emit('test', { value: 1 })

bus.expectEmitted('test')
bus.expectNotEmitted('other')

const data = bus.getEmittedFor('test')
// → [{ value: 1 }]

bus.reset()
```

## createMockLogger

Recording logger with `expectMessage` + `getEntriesAtLevel`:

```typescript
const log = createMockLogger()
log.info('hello', { user: 1 })
log.warn('careful')

log.expectMessage('hello')
log.getEntriesAtLevel('info')
// → [{ msg: 'hello', data: { user: 1 } }]
```

## createMockI18n

Minimal i18n stub for tests that don't need the full service:

```typescript
const i18n = createMockI18n({
  locale: 'en',
  bundles: {
    en: { 'foo.bar': 'Hello {name}' },
  },
})
i18n.t('foo.bar', { name: 'Tom' })
// → 'Hello Tom'
```

## InMemoryCharacterRepository

Drop-in replacement for `DbCharacterRepository` — implements the
full `CharacterRepository` port from `@nextvm/core` with in-memory Maps:

```typescript
import { InMemoryCharacterRepository } from '@nextvm/test-utils'
import { CharacterService } from '@nextvm/core'

const repo = new InMemoryCharacterRepository()
const characters = new CharacterService({ repository: repo })

const session = await characters.loadOrCreateUser({
  source: 1,
  license: 'license:abc',
})
expect(repo.userCount()).toBe(1)
```

## createModuleHarness

The big one: one-call wiring of an `RpcRouter` + namespace +
`charIdResolver` + recording bus + recording logger.

```typescript
import { createModuleHarness } from '@nextvm/test-utils'

const harness = createModuleHarness({
  namespace: 'banking',
  router: buildBankingRouter(service),
})

const result = await harness.dispatch(1, 'transfer', {
  toCharId: 2,
  type: 'cash',
  amount: 100,
})

harness.events.expectEmitted('banking:transactionCompleted')
```

The harness exposes:

| Field | Purpose |
|---|---|
| `dispatch(source, procedure, input)` | Run a real RPC call against the router |
| `events` | Recording event bus (assert via `expectEmitted`) |
| `log` | Recording logger |
| `rpc` | The underlying `RpcRouter` for advanced wiring |
| `reset()` | Clear events + logger between tests |

## See also

- [Testing guide](/guide/testing)
- [Module Authoring — Testing](/guide/module-authoring#6-testing-a-module)
