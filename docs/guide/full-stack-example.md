# Full Stack Example

A complete reference project that wires every NextVM layer together.
Lives in the repo at [`examples/full-stack/`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack).

Use it as a copy-paste starting point for a real server, or as a
walkable reference when something in your own project doesn't behave
like you expected.

## What it covers

| Layer | Where |
|---|---|
| Project config | `nextvm.config.ts` |
| Module entry (defineModule) | `modules/core/src/index.ts` |
| **Server bootstrap** with state-snapshot, dev-bridge, voice, compat | `modules/core/src/server/index.ts` |
| **Client bootstrap** with typed RPC proxies on `window.nextvm` | `modules/core/src/client/index.ts` |
| 6 first-party modules (banking, jobs, housing, inventory, player, vehicle) | declared as deps + listed in `nextvm.config.ts` |
| **NUI app** (Vite + React + `@nextvm/nui-react`) | `modules/core/nui/` |
| **Vite plugin** for the FiveM-friendly defaults + fxmanifest snippet | `modules/core/nui/vite.config.ts` |
| `fxmanifest.lua` with the auto-generated NUI block | `modules/core/fxmanifest.lua` |
| `server.cfg` snippet showing the correct `ensure` order | `server.cfg` |

## How it boots

```
nextvm dev
  └─ rebuilds modules/* on file change
  └─ writes .nextvm/dev-trigger.json after each rebuild

FXServer
  └─ ensure nextvm-banking      ← first-party module
  └─ ensure nextvm-jobs         ← uses banking via DI
  └─ ensure nextvm-housing      ← uses banking via DI
  └─ ensure nextvm-inventory
  └─ ensure nextvm-player
  └─ ensure nextvm-vehicle
  └─ ensure nextvm-core         ← bootstrapServer wires everything

nextvm-core
  └─ bootstrapServer({ modules, characterRepository, registerCompat,
                       stateSnapshot, devBridge })
  └─ ModuleLoader.initialize('server') runs every onModuleInit + onModuleReady
  └─ Auto-registers every module router via ctx.exposeRouter
  └─ Restores state from .nextvm/state-snapshot.json if recent
  └─ Attaches FiveM bridge: playerConnecting / Joining / Dropped /
                            __nextvm:rpc / setTick / onResourceStop
  └─ Starts dev bridge (watches dev-trigger.json) if nextvm_dev convar set
```

## Reading order

Start at the top, follow the imports:

1. [`nextvm.config.ts`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack/nextvm.config.ts) — project surface
2. [`modules/core/src/index.ts`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack/modules/core/src/index.ts) — `defineModule` entry
3. [`modules/core/src/server/index.ts`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack/modules/core/src/server/index.ts) — `bootstrapServer` wiring
4. [`modules/core/src/client/index.ts`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack/modules/core/src/client/index.ts) — `bootstrapClient` + RPC proxies
5. [`modules/core/nui/src/App.tsx`](https://github.com/nextvm-official/nextvm/tree/main/examples/full-stack/modules/core/nui/src/App.tsx) — React + `@nextvm/nui-react`

## Why it's outside the workspace

The example is a **standalone reference**, not a built workspace
member. Keeping it out of `pnpm-workspace.yaml` means:

- No install overhead in the framework's CI
- No accidental coupling between framework refactors and the example
- Users can copy the folder verbatim into their FXServer's
  `resources/` directory without worrying about workspace symlinks

To run it locally, build the workspace once (`pnpm build`), then
`cd examples/full-stack && pnpm install` to wire the example's own
dependencies.

## See also

- [End-to-End Quickstart](/guide/end-to-end) — narrative version of the same flow
- [`@nextvm/runtime-server`](/packages/runtime-server)
- [`@nextvm/runtime-client`](/packages/runtime-client)
- [`@nextvm/nui-react`](/packages/nui-react)
- [`@nextvm/vite-plugin-nui`](/packages/vite-plugin-nui)
