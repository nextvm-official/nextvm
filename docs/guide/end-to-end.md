# End-to-End Quickstart

A 10-minute walkthrough that takes a fresh machine and ends with a
NextVM-built FiveM resource serving real RPC calls from a real client.

## Prerequisites

- Node.js 22+, pnpm 9+
- A running FXServer (`txAdmin` or manual)
- MySQL 8 (optional — the runtime falls back to in-memory)

## 1. Scaffold a project

```bash
pnpm dlx @nextvm/cli create my-server
cd my-server
pnpm install
```

This creates:

```
my-server/
├── nextvm.config.ts
├── modules/
│   └── core/             # generated example module
├── package.json
└── tsconfig.json
```

## 2. Add a feature module

```bash
nextvm add shop --full
```

`--full` scaffolds a complete module skeleton with state, router,
locales, and a placeholder service. Open
[modules/shop/src/index.ts](modules/shop/src/index.ts) and you'll see:

```typescript
import { defineModule, z } from '@nextvm/core'
import { buildShopRouter } from './router'
import { ShopService } from './service'

export default defineModule({
  name: 'shop',
  version: '0.1.0',
  config: z.object({
    startingCredit: z.number().int().default(100),
  }),
  server: (ctx) => {
    const service = new ShopService()
    const router = buildShopRouter(service)
    ctx.exposeRouter(router)
    ctx.setExports({ service })
  },
})
```

## 3. Wire the server bootstrap

Create `modules/core/src/server/index.ts`:

```typescript
import { bootstrapServer } from '@nextvm/runtime-server'
import { Database, MySqlAdapter, DbCharacterRepository } from '@nextvm/db'
import shop from '../../../shop/src'

const db = new Database(new MySqlAdapter({
  host: GetConvar('mysql_host', 'localhost'),
  user: GetConvar('mysql_user', 'root'),
  password: GetConvar('mysql_password', ''),
  database: GetConvar('mysql_db', 'nextvm'),
}))

await bootstrapServer({
  modules: [shop],
  characterRepository: new DbCharacterRepository(db),
})
```

Without a database? Drop the `characterRepository` line — the runtime
falls back to an in-memory repository so you can smoke-test without
touching MySQL.

## 4. Wire the client bootstrap

Create `modules/core/src/client/index.ts`:

```typescript
import { bootstrapClient } from '@nextvm/runtime-client'
import { createClient } from '@nextvm/core'
import shop from '../../../shop/src'
import type { buildShopRouter } from '../../../shop/src/router'

const runtime = await bootstrapClient({ modules: [shop] })

// Typed RPC client — every call goes server-side, validated by Zod.
const shopRpc = createClient<ReturnType<typeof buildShopRouter>>(
  'shop',
  runtime.transport.call,
)

const offers = await shopRpc.listOffers()
console.log(offers)
```

## 5. Validate

```bash
nextvm validate
```

Runs all 13 architecture guards. If you imported a FiveM native
directly, used `TriggerServerEvent`, mutated global state, or built a
non-PLA-compliant payment flow, this fails before you ever hit
production.

## 6. Build

```bash
nextvm build
```

For each module, this:

1. Compiles TypeScript with tsup → ESM
2. Generates `fxmanifest.lua`
3. Bundles `src/shared/locales/*.ts` → `dist/locales/*.json`

Result:

```
modules/shop/
├── dist/
│   ├── server.js
│   ├── client.js
│   └── locales/{en,de}.json
└── fxmanifest.lua
```

## 7. Deploy

Copy each `modules/<name>/` folder into your FXServer's `resources/`
directory. The folder is self-contained — `dist/`, `fxmanifest.lua`,
and any locale assets travel together.

In `server.cfg`:

```cfg
ensure shop
ensure core
```

`core` (the bootstrap resource) must come last so its dependencies are
already up.

## 8. Verify

Connect a client. The server log shows:

```
[nextvm:loader] Initializing modules { side: 'server', order: ['shop', 'core'], count: 2 }
[nextvm:loader] Module initialized { module: 'shop', side: 'server' }
[nextvm:loader] Module initialized { module: 'core', side: 'server' }
[nextvm:loader] All modules ready { count: 2, side: 'server' }
[nextvm:runtime] Registered RPC router { module: 'shop' }
[nextvm:runtime] FiveM event bridge attached
[nextvm:runtime] NextVM server runtime ready { modules: 2 }
```

When the player joins:

```
[nextvm:runtime] handlePlayerConnecting { source: 5, name: 'Tom' }
[shop] new character ready { charId: 1 }
```

The first RPC call from the client (e.g. `shopRpc.listOffers()`) hits
the server's `__nextvm:rpc` net event, which dispatches to
`shopRouter.listOffers`, runs Zod validation, calls the handler, and
emits `__nextvm:rpc:response` back. The client's promise resolves with
the typed result.

## 9. Iterate with `dev`

```bash
nextvm dev
```

Watches every module's `src/`, rebuilds on change, fires
`onModuleRebuilt`. Restart the affected resource manually with
`ensure shop` (the live ensure-restart bridge is on the Phase 4 polish
list).

## What just happened

You wrote a TypeScript module, validated it against 13 architecture
guards, built it to a self-contained FiveM resource, and connected
both client and server runtimes through a typed RPC layer — without
touching a single FiveM native, `TriggerServerEvent`, or global state.

That's the entire NextVM loop.

## See also

- [Module Authoring](/guide/module-authoring) — deeper dive on conventions
- [Architecture Overview](/guide/architecture-overview) — the 5-layer model
- [Testing](/guide/testing) — how to unit-test modules in plain Node
- [`@nextvm/runtime-server`](/packages/runtime-server) — bootstrap reference
- [`@nextvm/runtime-client`](/packages/runtime-client) — bootstrap reference
