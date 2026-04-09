# Testing

NextVM is built test-first. The framework itself ships **213 tests**
across 18 packages, and `@nextvm/test-utils` gives module authors
everything they need to test their modules in plain Node.js without
spinning up an FXServer.

## Three test levels

NextVM follows the testing strategy from
[com/nextvm-official/nextvm/tree/main/docs/concept):

| Level | Tool | Speed | What it covers | Required for |
|---|---|---|---|---|
| **Unit** | Vitest + `@nextvm/test-utils` | < 1s | Business logic, validation, state transforms | Every module |
| **Integration** | FXServer test container | 10-30s | RPC round-trips, DB, state bag sync | Core PRs |
| **Manual** | Live FXServer | minutes | Visual UI, voice chat, full player flow | Pre-release QA |

This page focuses on unit tests — they cover the 80% case and run
locally in milliseconds.

## Unit testing — the basic shape

Every module follows the same two-test-file convention from
[Module Authoring](/guide/module-authoring):

```
modules/banking/__tests__/
├── service.test.ts    # Pure unit tests of the domain logic
└── router.test.ts     # End-to-end RPC tests via createModuleHarness
```

### Service tests

Service tests instantiate the service directly and exercise it:

```typescript
import { describe, expect, it } from 'vitest'
import { BankingService } from '../src/server/service'

describe('BankingService', () => {
  it('rejects insufficient transfers', async () => {
    const svc = new BankingService()
    svc.seed(1, { cash: 10 })
    await expect(svc.transfer(1, 2, 'cash', 100)).rejects.toThrow('INSUFFICIENT_FUNDS')
  })
})
```

No NextVM imports beyond the service itself. No mocks required for
pure functions. Run with `pnpm --filter @nextvm/banking test`.

### Router tests with `createModuleHarness`

Router tests use the harness from `@nextvm/test-utils` to dispatch
real RPC calls against an in-memory `RpcRouter`:

```typescript
import { createModuleHarness } from '@nextvm/test-utils'
import { describe, expect, it } from 'vitest'
import { BankingService, buildBankingRouter } from '../src'

const buildHarness = () => {
  const svc = new BankingService()
  return {
    svc,
    harness: createModuleHarness({
      namespace: 'banking',
      router: buildBankingRouter(svc),
    }),
  }
}

describe('banking router', () => {
  it('transfer rejects insufficient funds', async () => {
    const { svc, harness } = buildHarness()
    svc.seed(1, { cash: 50 })
    await expect(
      harness.dispatch(1, 'transfer', { toCharId: 2, type: 'cash', amount: 100 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
```

The harness wires up:
- A real `RpcRouter` with your router registered
- A 1:1 `source → charId` resolver (override via `charIdResolver`)
- A recording event bus you can assert on (`harness.events.expectEmitted('foo')`)
- A recording logger (`harness.log.expectMessage('saved')`)

## Mocking dependencies

If your module declares `dependencies: ['banking']`, your `server()`
function pulls banking via `ctx.inject<BankingAdapter>('banking')`.
For tests, give the harness a mocked banking via `createMockContext`:

```typescript
import { createMockContext } from '@nextvm/test-utils'

const banking = {
  addMoney: vi.fn(async () => 100),
  removeMoney: vi.fn(async () => 50),
}

const ctx = createMockContext({
  name: 'jobs',
  config: { salaryIntervalMinutes: 10 },
  injections: { banking },
})

// ...exercise the module's server() function with this context
```

Then `expect(banking.addMoney).toHaveBeenCalledWith(...)`.

## Mock helpers in `@nextvm/test-utils`

| Helper | What it gives you |
|---|---|
| `createMockContext` | A full `ModuleContext` with recording event bus, recording logger, lifecycle handler buckets, and DI injections |
| `createMockEventBus` | Recording event bus with `expectEmitted` / `expectNotEmitted` / `getEmittedFor` |
| `createMockLogger` | Recording logger with `expectMessage` / `getEntriesAtLevel` |
| `createMockI18n` | Minimal i18n stub for tests that don't need the real service |
| `InMemoryCharacterRepository` | Drop-in replacement for `DbCharacterRepository` — no MySQL needed |
| `createModuleHarness` | One-call wiring of an RpcRouter + namespace + recording bus |

## Testing the database layer

`@nextvm/db` itself is tested with a 100-line in-memory adapter that
implements just enough of `DatabaseAdapter` to drive the
`MigrationRunner`:

```typescript
function buildInMemoryAdapter(): DatabaseAdapter {
  const tables = new Map<string, Array<Record<string, unknown>>>()
  // ... very loose query/execute implementation
}
```

This lets us test the migration runner end-to-end without spinning up
MySQL. Modules that need DB testing can either:

- Use the same pattern (small in-memory adapter)
- Mock the `Database` class via `vi.mock('@nextvm/db')`
- Or use a real test MySQL instance (slower but covers SQL too)

For the character system specifically there's already
`InMemoryCharacterRepository` — use that.

## Running tests

```bash
# All tests across the workspace
pnpm test

# A specific package
pnpm --filter @nextvm/banking test

# Watch mode
cd modules/banking && pnpm vitest

# Coverage report
cd modules/banking && pnpm vitest --coverage
```

The root `pnpm test` runs every package serially via Turbo
(`--concurrency=1`) to avoid an esbuild race condition on Windows
where parallel vitest instances crash the esbuild service.

## CI integration

`.github/workflows/ci.yml` runs on every push and PR:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Build all packages
  run: pnpm run build

- name: Run all tests
  run: pnpm test
```

A green CI run means: 18 packages built clean and 213+ tests passed.

## What gets tested where

| Layer | Where tests live | What they cover |
|---|---|---|
| `@nextvm/core` | `packages/core/__tests__` | DI, EventBus, ErrorBoundary, RPC, State, Permissions, Logger, Tick, Profiler |
| `@nextvm/db` | `packages/db/__tests__` | Query builder, schema builder, migration runner |
| `@nextvm/i18n` | `packages/i18n/__tests__` | Interpolation, fallback chain, locale loading |
| `@nextvm/natives` | `packages/natives/__tests__` | Routing service, batch processor, useNative |
| `@nextvm/build` | `packages/build/__tests__` | Project loader, fxmanifest, locale bundler |
| `@nextvm/tebex` | `packages/tebex/__tests__` | Webhook verify, client request shape |
| `@nextvm/registry` | `packages/registry/__tests__` | Search, manifest fetch, tarball SHA verify |
| `@nextvm/migration` | `packages/migration/__tests__` | ESX/QBCore migration runner, dry-run, malformed-row skip |
| `@nextvm/banking` | `modules/banking/__tests__` | Service + router |
| `@nextvm/jobs` | `modules/jobs/__tests__` | Service + adapter pattern |
| `@nextvm/housing` | `modules/housing/__tests__` | Property registry + service + routing |

## Anti-patterns to avoid

| ❌ Don't | ✅ Do |
|---|---|
| Test the framework's internals from your module | Test your module's API surface |
| Spin up a real RpcRouter manually | Use `createModuleHarness` |
| Stub the global `fetch` | Inject a `Fetcher` (the registry + tebex packages do this) |
| Test against a real MySQL instance for unit tests | Use `InMemoryCharacterRepository` or a small in-memory adapter |
| Skip tests because "the runtime layer makes them hard" | Use the harness — every module surface is testable |
