# NextVM Module Architecture

This document describes how to build a NextVM module the right way.
It is **prescriptive** — community modules that follow this layout will
pass `nextvm validate` and integrate cleanly with the rest of the
ecosystem. Modules that ignore it still build, but they will look out of
place and will be harder to test, document, and migrate.

The reference implementations are `modules/banking`, `modules/jobs`,
and `modules/housing`. When in doubt, copy from one of those.

---

## 1. Module Layers

A NextVM module is a small layered application. The layers are
ordered from least to most opinionated; lower layers must not depend
on higher ones.

```
┌─────────────────────────────────────────────────────────┐
│ src/index.ts                                            │  ← Wiring
│   defineModule({ name, deps, server, client, shared }) │
├─────────────────────────────────────────────────────────┤
│ src/server/router.ts          src/client/index.ts       │  ← Boundary
│   buildModuleRouter(service)    UI / world hooks        │
├─────────────────────────────────────────────────────────┤
│ src/server/service.ts                                   │  ← Domain
│   business logic, state mutation, event emission        │
├─────────────────────────────────────────────────────────┤
│ src/server/repository.ts (optional)                     │  ← Persistence
│   DB read/write via @nextvm/db                          │
├─────────────────────────────────────────────────────────┤
│ src/shared/{schemas,constants,locales}                  │  ← Contracts
│   Zod schemas, item registries, en/de.ts                │
├─────────────────────────────────────────────────────────┤
│ src/adapters/<dep>-adapter.ts                           │  ← Outbound
│   Interface this module needs from another module       │
└─────────────────────────────────────────────────────────┘
```

### Why the split?

- **service.ts** is pure: it takes typed input, mutates state, emits
  events, and returns typed output. It is unit-testable without
  spinning up an RpcRouter.
- **router.ts** is the boundary: it converts a wire-level RPC call
  into a service call. It owns Zod validation and `RpcError` mapping.
- **repository.ts** isolates database I/O so the service can be
  tested with an in-memory backend (`InMemoryCharacterRepository`-style).
- **adapters/** declare the small interfaces this module needs from
  *other* modules. The full interface lives there, not in the consumed
  module — that is the  escape hatch for inter-module deps.

---

## 2. The defineModule() Wiring File

`src/index.ts` is glue code only. It should be one screen long.

```typescript
import { defineExports, defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import type { BankingAdapter } from './adapters/banking-adapter'
import { buildBankingRouter } from './server/router'
import { BankingService } from './server/service'

/** Public service surface — consumed via inject<BankingExports>('banking') */
export type BankingExports = ReturnType<typeof buildBankingExports>

function buildBankingExports(service: BankingService) {
	return defineExports({
		service,
		addMoney: service.addMoney.bind(service),
		removeMoney: service.removeMoney.bind(service),
		transfer: service.transfer.bind(service),
		getBalance: service.get.bind(service),
	})
}

export default defineModule({
	name: 'banking',
	version: '0.1.0',
	dependencies: ['player'],

	config: z.object({
		startingCash: z.number().int().min(0).default(500)
			.describe('Cash given on first spawn'),
	}),

	server: (ctx) => {
		const config = ctx.config as { startingCash: number }
		const service = new BankingService()

		// Pull declared deps from DI
		// (banking has none of its own; jobs/housing pull banking)

		// Publish public surface
		ctx.setExports(buildBankingExports(service))

		// Wire lifecycle
		ctx.onPlayerReady(async (player) => {
			service.seed(player.character.id, { cash: config.startingCash })
		})
	},

	client: (ctx) => {
		ctx.log.info('banking client loaded')
	},

	shared: {
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

// Re-export the service for testing + advanced consumers
export { BankingService } from './server/service'
export type { BankingAdapter } from './adapters/banking-adapter'
```

---

## 3. SOLID applied

### Single Responsibility
Each file owns one concern. `service.ts` knows business rules,
`router.ts` knows the wire format, `repository.ts` knows SQL.

### Open / Closed
Extend behavior by:
- subscribing to events on the shared bus (`ctx.events.on('banking:tx', ...)`)
- registering more procedures via a separate router file
- providing a different repository implementation behind the same port

Never modify another module's source.

### Liskov Substitution
Repository ports (e.g. `CharacterRepository`) are interfaces. Tests
substitute `InMemoryCharacterRepository` for `DbCharacterRepository`
with no behavior change.

### Interface Segregation
The **Adapter Pattern** is the canonical solution to cross-module
deps in NextVM. Define the interface **in the consuming module**:

```typescript
// modules/jobs/src/adapters/banking-adapter.ts
export interface BankingAdapter {
	addMoney(
		charId: number,
		type: 'cash' | 'bank',
		amount: number,
		reason?: string,
	): Promise<number>
}
```

Then consume it via DI:

```typescript
const banking = ctx.inject<BankingAdapter>('banking')
service.setBanking(banking)
```

The producer (banking) does not have to know who consumes its API.
The consumer (jobs) does not have to import the producer.

### Dependency Inversion
High-level modules (jobs, housing) depend on **adapter interfaces**,
not on concrete service classes. The actual implementation is wired
in via `setExports()` + `inject()` at module-init time.

---

## 4. Cross-Module Communication: Three Patterns

### Pattern A — Service injection (sync, typed)
Use when the consumer needs a typed function call to the producer.

```typescript
// jobs consumes banking
const banking = ctx.inject<BankingAdapter>('banking')
await banking.addMoney(charId, 'bank', 200, 'salary')
```

**When:** function-call-style coupling, response needed, type safety
matters.

### Pattern B — Typed events (async, decoupled)
Use when multiple modules might react to the same fact.

```typescript
// banking emits
ctx.events.emit('banking:transactionCompleted', { from, to, amount })

// audit, analytics, anti-cheat all subscribe independently
ctx.events.on('banking:transactionCompleted', (data) => { ... })
```

**When:** fan-out, audit trails, cross-cutting concerns.

### Pattern C — Shared state (when watch + react is required)
Use when consumers need to react to mutations of typed state.

```typescript
playerState.subscribe(charId, 'job', (newJob, oldJob) => {
	syncDiscordRole(charId, newJob)
})
```

**When:** UI binding, derived state, automatic synchronization.

---

## 5. Sub-Feature Pattern (for large modules)

Once a module exceeds ~500 lines or owns more than ~5 features,
split it into sub-feature folders. Convention:

```
modules/phone/
├── src/
│   ├── index.ts                    # Wiring (one screen)
│   ├── server/
│   │   ├── service.ts              # Top-level service (composes features)
│   │   └── router.ts               # Top-level router (mounts feature routers)
│   ├── features/
│   │   ├── contacts/
│   │   │   ├── service.ts
│   │   │   ├── router.ts
│   │   │   ├── schema.ts
│   │   │   └── repository.ts
│   │   ├── messages/
│   │   │   ├── service.ts
│   │   │   ├── router.ts
│   │   │   └── schema.ts
│   │   └── apps/
│   │       └── ...
│   ├── shared/
│   │   ├── constants.ts
│   │   └── locales/
│   └── adapters/
│       └── banking-adapter.ts      # cross-module deps still at module root
└── __tests__/
    ├── contacts.test.ts
    ├── messages.test.ts
    └── ...
```

The top-level `service.ts` and `router.ts` are thin composers — they
mount feature routers under the module's namespace and forward
lifecycle hooks to feature services.

---

## 6. Testing a Module

Two test layers per module:

### Service tests — pure unit tests
Stand up the service with a fake adapter and exercise it directly.

```typescript
import { BankingService } from '../src/server/service'

describe('BankingService', () => {
	it('rejects insufficient transfers', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 10 })
		await expect(svc.transfer(1, 2, 'cash', 100)).rejects.toThrow('INSUFFICIENT_FUNDS')
	})
})
```

### Router tests — end-to-end via createModuleHarness
Use the harness from `@nextvm/test-utils` to dispatch real RPC
calls and assert on the responses.

```typescript
import { createModuleHarness } from '@nextvm/test-utils'

const buildHarness = () => {
	const svc = new BankingService()
	return createModuleHarness({
		namespace: 'banking',
		router: buildBankingRouter(svc),
	})
}

it('rejects bad input via Zod', async () => {
	const harness = buildHarness()
	await expect(
		harness.dispatch(1, 'addMoney', { charId: 2, type: 'cash', amount: -5 }),
	).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
})
```

---

## 7. Required Files Checklist

Every module must have:

- [ ] `src/index.ts` — defineModule wiring
- [ ] `src/server/service.ts` (or `src/server/index.ts` if trivial)
- [ ] `src/server/router.ts` if it exposes RPC
- [ ] `src/shared/locales/en.ts`
- [ ] At least one of `__tests__/service.test.ts` or `__tests__/router.test.ts`
- [ ] `package.json` with peerDependencies for every workspace dep
- [ ] `tsconfig.json` extending `../../tsconfig.base.json`
- [ ] `tsup.config.ts` with externals for every workspace dep
- [ ] `vitest.config.ts`

`nextvm validate` checks the first three and warns on missing tests.

---

## 8. Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---|---|
| `import { BankingService } from '../../banking/src/service'` | `ctx.inject<BankingAdapter>('banking')` |
| `(ctx as unknown as { exports }).exports = ...` | `ctx.setExports(buildExports(service))` |
| Hardcoded English strings in router responses | Translation keys via `@nextvm/i18n` |
| `let cache = new Map()` at module top level | Instance state inside the service class |
| Money / inventory writes inside `client:` | Server-only mutation |
| `setTick(() => doStuff())` in client | `ctx.onTick(handler, { interval, priority })` |
| Direct `SetEntityCoords()` call | `entity.setPosition({ x, y, z })` from `@nextvm/natives` |

---

## 9. When in Doubt

1. Look at `modules/banking/` — minimal complete reference
2. Look at `modules/jobs/` — module with both service + tick + DI
3. Look at `modules/housing/` — module with routing-instance integration
4. Read the relevant chapter in [`docs/concept/`](../concept/index.md)
5. Run `nextvm validate` early and often
