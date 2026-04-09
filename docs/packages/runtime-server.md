# @nextvm/runtime-server

The "last mile" between a built NextVM module bundle and a running
FXServer. Importing this package gives you a single function —
`bootstrapServer` — that wires every NextVM core service to the live
FiveM event surface.

## Install

```bash
pnpm add @nextvm/runtime-server
```

## Minimal usage

```typescript
// modules/my-server/src/server/index.ts
import { bootstrapServer } from '@nextvm/runtime-server'
import banking from '@nextvm/banking'
import jobs from '@nextvm/jobs'

await bootstrapServer({
  modules: [banking, jobs],
})
```

That's it. The runtime:

1. Registers every passed module with the `ModuleLoader`
2. Wires a `CharacterService` (in-memory by default — see below for DB)
3. Wires the `RpcRouter` with the character resolver + profiler
4. Calls `loader.initialize('server')` so every module's `server()`
   entry point runs and `onModuleInit` / `onModuleReady` hooks fire
5. Attaches FiveM event handlers:
   - `playerConnecting` → resolves identifiers, loads/creates User,
     fires `onPlayerConnecting` hooks
   - `playerJoining` → fires `onPlayerReady` if a character is selected
   - `playerDropped` → fires `onPlayerDropped`, persists session
   - `__nextvm:rpc` → routes to the typed `RpcRouter`
   - `onResourceStop` → graceful shutdown via `onModuleStop` hooks
6. Starts the managed tick loop via `setTick(() => runFrame())`

## Production: with a real database

```typescript
import { bootstrapServer } from '@nextvm/runtime-server'
import { Database, MySqlAdapter, DbCharacterRepository } from '@nextvm/db'
import banking from '@nextvm/banking'

const db = new Database(new MySqlAdapter({
  host: GetConvar('mysql_host', 'localhost'),
  user: GetConvar('mysql_user', 'root'),
  password: GetConvar('mysql_password', ''),
  database: GetConvar('mysql_db', 'nextvm'),
}))

await bootstrapServer({
  modules: [banking],
  characterRepository: new DbCharacterRepository(db),
})
```

## With ESX/QBCore compat

```typescript
import { bootstrapServer } from '@nextvm/runtime-server'
import { setupCompat } from '@nextvm/compat'
import banking from '@nextvm/banking'

await bootstrapServer({
  modules: [banking],
  registerCompat: ({ exportsApi, dataSource }) => {
    setupCompat({ exportsApi, dataSource })
  },
})
```

After this, legacy Lua resources can keep calling
`exports['es_extended']:getSharedObject()` and receive properly-shaped
objects backed by NextVM data.

## API

### `bootstrapServer(opts): Promise<RuntimeHandle>`

| Option | Required | Description |
|---|---|---|
| `modules` | yes | Module definitions to register |
| `characterRepository` | no | Real `CharacterRepository` (default: in-memory) |
| `registerCompat` | no | Callback to wire `@nextvm/compat` |
| `stateSnapshot` | no | Hot-reload state snapshot config — `false` to disable, `{ path, staleAfterMs }` to override defaults |
| `devBridge` | no | Live ensure-restart bridge for `nextvm dev` — `true` to enable with defaults, object to override |
| `tickIntervalMs` | no | Reserved for future use |

### State hot-reload

On `runtime.stop()` (driven by `onResourceStop`), the runtime walks
every state store registered via `shared.schemas` on the modules,
calls `serialize()`, and writes one timestamped JSON file:

```
.nextvm/state-snapshot.json
```

On the next `bootstrapServer()`, if that file exists *and* is younger
than `staleAfterMs` (default 60s — long enough for an `ensure` restart,
short enough that we don't restore stale state on a real cold boot),
the runtime deserializes every matching store and deletes the file.

This means `ensure my-module` during `nextvm dev` no longer wipes
player state — characters keep their cash, inventory slots, jobs, etc.
across the rebuild loop. New stores are restored to schema defaults,
removed stores are silently dropped, version mismatches are rejected.

Disable with `stateSnapshot: false`. Override the path or stale window:

```typescript
await bootstrapServer({
  modules: [banking],
  stateSnapshot: {
    path: '/var/run/nextvm/snap.json',
    staleAfterMs: 5 * 60_000,
  },
})
```

### Live ensure-restart bridge (dev only)

`nextvm dev` writes `.nextvm/dev-trigger.json` after each successful
per-module rebuild. When you boot the runtime with `devBridge: true`,
it watches that file and runs `ExecuteCommand('ensure <module>')`
inside the FXServer whenever a fresh trigger appears. Combined with
`stateSnapshot`, the rebuild loop becomes:

```
nextvm dev rebuild → trigger file → runtime ensure → state snapshot
  → resource restart → bootstrap restores snapshot → player keeps state
```

Wire it from your bootstrap:

```typescript
await bootstrapServer({
  modules: [banking, jobs],
  // Both default-on for production safety; flip in dev only.
  devBridge: process.env.NEXTVM_DEV === '1' ? true : undefined,
})
```

Or override the trigger path:

```typescript
devBridge: { path: '/var/run/nextvm/dev-trigger.json' }
```

The bridge debounces duplicate events, ignores stale triggers (>5s by
default), and silently drops malformed JSON. Tests inject a custom IO
adapter so the whole feature is unit-testable in plain Node.

### `RuntimeHandle`

The return value. Production code only ever calls `.stop()`. Tests use
the rest of the surface to drive the runtime deterministically without
spinning up a real FXServer:

| Method | Purpose |
|---|---|
| `loader` | The underlying `ModuleLoader` |
| `runFrame(now?)` | Run a single tick frame (test helper) |
| `handlePlayerConnecting(src, name, deferrals?)` | Trigger the connecting flow |
| `handlePlayerReady(src)` | Trigger the ready flow |
| `handlePlayerDropped(src, reason)` | Trigger the dropped flow |
| `dispatchRpc(src, namespace, procedure, input)` | Dispatch a server-side RPC |
| `stop()` | Graceful shutdown |

## What it does NOT do

- **Live `nextvm dev` orchestration of FXServer processes** — the
  runtime can `ensure` a module, but starting the FXServer itself is
  still up to you (or your admin tooling).

## See also

- [`bootstrapServer` source](https://github.com/nextvm-official/nextvm/blob/main/packages/runtime-server/src/bootstrap.ts)
- [`@nextvm/core`](/packages/core) — the underlying `ModuleLoader`
- [`@nextvm/db`](/packages/db) — production `CharacterRepository`
- [`@nextvm/compat`](/packages/compat) — ESX/QBCore exports
