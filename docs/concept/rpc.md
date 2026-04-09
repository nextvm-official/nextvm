# RPC

> Concept v2.3, Chapter 10

NextVM's RPC system is inspired by tRPC. Compile-time type-safe remote
procedure calls between client and server, with no string-based
`TriggerServerEvent`. Every input is Zod-validated. Every call is
rate-limited per player.

## defineRouter

A router is a record of named procedures:

```typescript
import { defineRouter, procedure, RpcError, z } from '@nextvm/core'

export const bankingRouter = defineRouter({
  getBalance: procedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input, ctx }) => {
      return loadBalance(input.accountId)
    }),

  transfer: procedure
    .input(z.object({
      from: z.string(),
      to: z.string(),
      amount: z.number().positive(),
    }))
    .auth((ctx) => permissions.hasPermission(ctx.source, 'banking.transfer'))
    .mutation(async ({ input, ctx }) => {
      // ctx.source is framework-injected and NOT spoofable
      return await service.transfer(input.from, input.to, input.amount)
    }),
})
```

## procedure builder

Every procedure is built by chaining a fluent builder:

| Method | Effect |
|---|---|
| `.input(zodSchema)` | Adds compile-time + runtime input validation |
| `.auth(middleware)` | Runs an authorization check before the handler |
| `.query(handler)` | Finalizes as a read-only query |
| `.mutation(handler)` | Finalizes as a write/mutation |

`.input()` is required for any procedure that takes input. The
[`nextvm validate`](/cli/validate) check enforces this for mutations
specifically (queries that take no input are common and exempt).

## Client-side calls

The client calls procedures through the typed proxy:

```typescript
const balance = await nextvm.rpc.banking.getBalance({ accountId: '123' })
//    ^? fully typed return value

await nextvm.rpc.banking.transfer({
  from: 'a',
  to: 'b',
  amount: 500,
})
```

The TypeScript types come from importing the router definition:

```typescript
import type { bankingRouter } from '@nextvm/banking'
import { createClient } from '@nextvm/core'

const banking = createClient<typeof bankingRouter>('banking', transport)
const balance = await banking.getBalance({ accountId: '123' })
```

## Security

Concept Chapter 10.3 mandates several security properties — all
implemented in `RpcRouter.dispatch()`:

### 1. Source ID injection
The framework injects `ctx.source` from the secure server-side player
table. Clients **cannot spoof** the source — it doesn't come from the
wire payload.

### 2. Per-player rate limiting
Every procedure gets a token-bucket rate limiter keyed by
`(source, procedure)`. Default capacity is 60 tokens with a refill
rate of 30 tokens/second. Calls beyond the limit raise
`RpcError('RATE_LIMITED')`.

### 3. Zod input validation
Every `.input()` schema is parsed via `safeParse` before the handler
runs. Validation failures raise `RpcError('VALIDATION_ERROR')` with
the full Zod issue list in `details`.

### 4. Auth middleware
`.auth(fn)` runs after validation but before the handler. Failures
raise `RpcError('AUTH_ERROR')`.

### 5. Encryption adapter
Anti-cheat solutions (WaveShield, FiveGuard) can plug in an
`RpcEncryptionAdapter` that decrypts every payload before validation.
The adapter is one method:

```typescript
interface RpcEncryptionAdapter {
  decrypt: (payload: unknown, source: number) => unknown
  encrypt: (payload: unknown, source: number) => unknown
}

router.setEncryptionAdapter(myAdapter)
```

The framework's RPC handlers don't need to know encryption is in
play — the adapter handles it transparently.

## Error handling

`RpcError` carries a typed error code so the client can distinguish
"your input was bad" from "the server crashed":

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Input failed Zod validation |
| `AUTH_ERROR` | Auth middleware denied |
| `NOT_FOUND` | Unknown namespace or procedure |
| `RATE_LIMITED` | Too many calls in the rate window |
| `INTERNAL_ERROR` | Handler threw an unexpected error |

```typescript
try {
  await nextvm.rpc.banking.transfer({ ... })
} catch (err) {
  if (err instanceof RpcError) {
    if (err.code === 'VALIDATION_ERROR') showFormError(err.details)
    else if (err.code === 'RATE_LIMITED') showCooldown()
    else logError(err)
  }
}
```

## Profiler integration

Every RPC handler is timed by the built-in profiler. The samples are
recorded under the key `rpc:<namespace>:<procedure>` and surfaced via
[`nextvm perf`](/cli/perf):

```
rpc:banking:transfer  count=42  avg=3.1ms  p95=12ms  max=45ms
```

## Error boundary integration

If a handler throws an unexpected error, it's recorded in the
ErrorBoundary's per-module counter. If the module exceeds the
threshold (default 10/min), it gets marked as **degraded** — its
tick handlers stop running and its event handlers stop being invoked
until an admin re-enables it. See [Error Boundaries](/concept/error-boundaries).

## Testing with createModuleHarness

```typescript
import { createModuleHarness } from '@nextvm/test-utils'

const harness = createModuleHarness({
  namespace: 'banking',
  router: buildBankingRouter(service),
})

const result = await harness.dispatch(1, 'transfer', {
  from: 'a', to: 'b', amount: 100,
})
expect(result).toEqual({ ok: true })
```

The harness wires up a real `RpcRouter`, registers your router, and
gives you a typed `dispatch(source, procedure, input)` helper. Tests
exercise the full validation + auth + handler pipeline without spinning
up an FXServer.

## See also

- [`@nextvm/core` package reference](/packages/core)
- [`createModuleHarness`](/guide/testing#router-tests-with-createmodulharness)
- [Concept v2.3 Chapter 10](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
