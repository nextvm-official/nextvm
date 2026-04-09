# @nextvm/runtime-client

Mirror of [`@nextvm/runtime-server`](/packages/runtime-server) for the
client side. Importing this package gives you a single function —
`bootstrapClient` — that wires the `ModuleLoader`, the typed RPC
transport, and FiveM client events into one start function.

## Install

```bash
pnpm add @nextvm/runtime-client
```

## Minimal usage

```typescript
// modules/my-server/src/client/index.ts
import { bootstrapClient } from '@nextvm/runtime-client'
import banking from '@nextvm/banking'
import jobs from '@nextvm/jobs'

await bootstrapClient({
  modules: [banking, jobs],
})
```

The runtime:

1. Registers every passed module with the `ModuleLoader`
2. Auto-wires a `RuntimeRpcTransport` against the FiveM client globals
3. Calls `loader.initialize('client')` so each module's `client()`
   entry runs and `onModuleInit` / `onModuleReady` hooks fire
4. Bridges FiveM client events:
   - `playerSpawned` → `onMounted` (the "framework is ready, the
     local player ped exists" hook from Concept 8.3)
   - `onClientResourceStop` → `onModuleStop`
5. Starts the managed tick loop via `setTick`

## RPC transport wire protocol

```
client → server: emitNet('__nextvm:rpc', namespace, procedure, input, requestId)
server → client: emitNet('__nextvm:rpc:response', requestId, errorMessage|null, result|null)
```

The transport keeps a `Map<requestId, { resolve, reject }>` and
resolves the matching entry when the response event fires. Unknown
ids are dropped silently. Each call has a 10s default timeout
(configurable via `RuntimeRpcTransport({ timeoutMs })`).

## Using a typed RPC client

```typescript
import { createClient } from '@nextvm/core'
import { bootstrapClient } from '@nextvm/runtime-client'
import type { bankingRouter } from '@nextvm/banking'

const runtime = await bootstrapClient({ modules: [/* ... */] })
const banking = createClient<typeof bankingRouter>('banking', runtime.transport.call)

const balance = await banking.getMyBalance()
```

## API

### `bootstrapClient(opts): Promise<ClientRuntimeHandle>`

| Option | Required | Description |
|---|---|---|
| `modules` | yes | Module definitions to register |
| `transport` | no | Inject a custom transport (tests use this) |

### `ClientRuntimeHandle`

| Method | Purpose |
|---|---|
| `loader` | The underlying `ModuleLoader` |
| `transport` | The `RuntimeRpcTransport` instance |
| `runFrame(now?)` | Run a single tick frame (test helper) |
| `handleMounted()` | Trigger the `onMounted` flow |
| `stop()` | Graceful shutdown |

## See also

- [`@nextvm/runtime-server`](/packages/runtime-server) — server side
- [`@nextvm/core`](/packages/core) — `createClient` typed proxy
- [Concept Chapter 10.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
