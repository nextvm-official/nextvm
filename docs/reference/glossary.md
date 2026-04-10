# Glossary

Terms used throughout NextVM docs and code.

## Adapter
An interface defined by a *consuming* module that describes the surface
it needs from a *providing* module. The provider implements the adapter
and registers it via `ctx.setExports()`.

## Bucket
A FiveM routing bucket — a logical "world" that isolates players from
each other. NextVM exposes them via `RoutingService` and the
`onBucketChange` lifecycle hook. Requires [OneSync](#onesync).

## Convar
A console variable in FXServer (e.g. `sv_hostname`, `onesync`). Set via
`set <key> <value>` in `server.cfg` or via `fxserver.convars` in
`nextvm.config.ts`. See [FiveM Basics → Convars](/guide/fivem-basics#convars).

## Character
A persistent player identity within a NextVM server. A single FiveM
account (User) may own multiple Characters. All player data is keyed by
`charId`.

## ctx (ModuleContext)
The object passed to every lifecycle hook. Provides DI (`inject`),
exports (`setExports`), the RPC router, the i18n function, the logger,
and the tick scheduler.

## defineExports
Helper that creates a typed exports interface for a module without the
`as unknown` cast. See .

## defineModule
The entry point of every NextVM module. Declares name, dependencies,
and lifecycle hooks.

## defineState
Creates a character-scoped state store with a Zod schema. State is
hot-reloadable and survives module rebuilds in dev mode.

## ErrorBoundary
A rolling-window error counter per module. When a module exceeds its
threshold, the boundary opens and the module is degraded (its tick
handlers and RPCs become no-ops) until manually reset.

## fxmanifest.lua
The FiveM resource manifest. Generated automatically by `nextvm build`
from each module's `package.json`.

## Layer
NextVM has 5 layers: Runtime → Natives → Core → Modules → Content.
Each layer may only import from the layer directly below it.

## Lifecycle hook
One of 9 callbacks a module can register: `onModuleInit`, `onModuleReady`,
`onPlayerConnecting`, `onPlayerReady`, `onPlayerDropped`, `onMounted`,
`onCharacterSwitch`, `onBucketChange`, `onTick`, `onModuleStop`.

## ModuleLoader
The core service that discovers modules, resolves dependencies via a
topological sort, and drives the lifecycle.

## Native
A FiveM client or server API function (e.g. `GetPlayerName`). Wrapped
by `@nextvm/natives`. Modules may not call natives directly.

## OneSync
FXServer's state awareness mode. Makes all entities server-authoritative,
enables routing buckets, and unlocks Infinity (128+ players). Enable via
`set onesync on` in `server.cfg` or `convars: { onesync: 'on' }` in
`nextvm.config.ts`. See [FiveM Basics → OneSync](/guide/fivem-basics#onesync).

## PLA
[Cfx.re Platform License Agreement](https://forum.cfx.re/t/4571423).
The legal terms every FiveM server must follow. See [PLA reference](/reference/pla).

## Resource
A FXServer plugin — a folder inside `resources/` containing a
`fxmanifest.lua` and scripts. Managed via `ensure`/`stop`/`start`
commands. NextVM modules compile to resources. See
[FiveM Basics → Resources](/guide/fivem-basics#resources).

## RPC
Typed remote procedure call. NextVM's tRPC-style router with Zod input
validation, rate limiting, and middleware. Replaces `TriggerServerEvent`.

## server.cfg
FXServer's main configuration file. Controls endpoints, convars, ACL
entries, and which resources to `ensure` on boot. NextVM generates a
separate `server.cfg.nextvm` and never touches the original. See
[FiveM Basics → server.cfg](/guide/fivem-basics#server-cfg).

## TickScheduler
The managed tick loop with HIGH/MEDIUM/LOW priorities and per-frame
budget control. Replaces `Citizen.CreateThread` for module work.

## User
A FiveM account, identified by license/discord/steam. Owns one or more
Characters.
