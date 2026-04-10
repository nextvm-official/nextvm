# Local FXServer

Run a real FXServer subprocess directly from `nextvm dev` so editing
a module file rebuilds it and live-reloads it inside the running
server — the same idea as `next dev` for a Next.js app.

This page covers the **one-time setup** plus the daily loop. If you
already have FXServer installed, jump to [Configure your project](#configure-your-project).

## What you get

```bash
pnpm nextvm dev --serve
```

- The framework rebuilds every module under `modules/*`
- It links them into the FXServer's `resources/[nextvm]/`
- It generates a fresh `server.cfg.nextvm` from `nextvm.config.ts`
- It spawns FXServer as a child process and streams the logs into
  your terminal (cyan `[fx]` prefix)
- File changes trigger a rebuild + `ensure <module>` inside FXServer,
  preserving connected player state via the snapshot mechanism
- `Ctrl+C` shuts everything down cleanly — including the FXServer
  process tree on Windows

::: info NextVM does **not** install FXServer for you
NextVM is a framework, not a server bootstrapper. You bring your own
FXServer artifact and `cfx-server-data` baseline; NextVM configures
and runs them. See [the rationale](#why-nextvm-doesn-t-install-fxserver).
:::

## One-time setup

### 1. Install FXServer

Download the latest server build for your platform from the
[FiveM artifacts](https://runtime.fivem.net/artifacts/fivem/) and
extract it somewhere stable.

### 2. Get the cfx-server-data baseline

```bash
git clone https://github.com/citizenfx/cfx-server-data
```

This is the standard FiveM baseline (mapmanager, sessionmanager,
spawnmanager, basic-gamemode, hardcap). FXServer can boot without it
but won't accept clients.

### 3. Get a Cfx.re license key

Sign up at [keymaster.fivem.net](https://keymaster.fivem.net) and
create a key for your IP. Local-only dev runs work without a key —
the server will start in offline mode and warn loudly.

## Configure your project

Add a `fxserver` block to `nextvm.config.ts`:

```typescript
export default {
  server: {
    name: 'My Dev Server',
    maxPlayers: 8,
    defaultLocale: 'en',
  },
  database: {
    /* ... */
  },
  modules: [],
  fxserver: {
    // Folder containing FXServer.exe (Windows) or run.sh / FXServer (Linux)
    path: 'C:/fivem/server',

    // Optional — only needed for split layouts where binary and
    // resources/ live in separate folders. The standard
    // cfx-server-data layout has them split.
    dataPath: 'C:/fivem/server-data',

    // Read from env so the key never lands in git
    licenseKey: process.env.CFX_LICENSE_KEY,

    endpoint: '0.0.0.0:30120',
    gameBuild: 3095,
    additionalResources: ['pma-voice'],
    convars: {
      sv_projectName: 'My Dev Server',
      sv_projectDesc: 'NextVM dev sandbox',
    },
  },
}
```

The starter template (`pnpm create nextvm@latest --template starter`)
ships this block pre-wired and gated on `process.env.FXSERVER_PATH`.

::: info Recommended convars
At minimum, set `sv_projectName` and `sv_projectDesc` — without
them FXServer warns on every boot and your server name gets cut off
in the server list. For multiplayer, enable OneSync:
```typescript
convars: {
  sv_projectName: 'My Server',
  sv_projectDesc: 'A NextVM-powered experience',
  onesync: 'on',
},
```
See [FiveM Server Basics → Convars](/guide/fivem-basics#convars) for
the full reference.
:::

::: tip Layout auto-detection
If `path` and `dataPath` point at the same folder, NextVM treats it
as the all-in-one artifact layout. If they differ, it uses `path` for
the binary and `dataPath` for `resources/` + the spawn cwd. Both work.
:::

## Daily loop

```bash
pnpm nextvm dev --serve
```

You should see something like:

```
▲ NextVM v0.0.x
dev — watching modules for changes

  › Initial build of 3 module(s)…
  ✓ Initial build completed in 64ms

  [runner] Resolved FXServer binary: C:\fivem\server\FXServer.exe
  [runner] Linked 3 module(s) (symlinks)
  [runner] Wrote C:\fivem\server-data\server.cfg.nextvm
  [runner] FXServer started (PID 12345)
  ✓ FXServer running (PID 12345)
  ✓ Watching 3 modules for changes
  Press Ctrl+C to stop.

  [fx] [   resources] Scanning resources.
  [fx] [   resources] Found 27 resources.
  [fx] [  svadhesive] Server license key authentication succeeded.
  [fx] [   resources] Started resource shop
  ...
```

Edit any file under `modules/<name>/src/`. NextVM rebuilds within
~10ms, writes a `.nextvm/dev-trigger.json`, and the runtime-server's
dev bridge inside FXServer picks it up:

```
22:42:10 ● Rebuilding shop…
22:42:10 ✓ shop rebuilt in 9ms
[runner] ensure shop (via dev-trigger)
[fx] [resources] Stopping resource shop
[fx] [resources] Started resource shop
```

Your connected player keeps their state across the reload via the
`stateSnapshot` mechanism in `@nextvm/runtime-server`.

## Anatomy of what gets generated

NextVM never touches your hand-managed `server.cfg`. It writes to
`server.cfg.nextvm` next to it and spawns FXServer with
`+exec server.cfg.nextvm`. Example output:

```
# Generated by NextVM. Do not edit by hand…

# Network
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

# Game build
sv_scriptHookAllowed 0
sv_enforceGameBuild 3095

# NextVM dev bridge — absolute path to dev-trigger.json
set nextvm_dev_trigger "F:/projects/my-server/.nextvm/dev-trigger.json"

# NextVM dev bridge — grant ensure ACL to live-reloaded modules
add_ace resource.shop command allow
add_ace resource.banking command allow

sv_hostname "My Dev Server"
sv_maxclients 8

ensure shop
ensure banking
```

The `[nextvm]/` category folder under `resources/` is fully managed
by the runner — symlinks (or junctions on Windows) are created on
start and removed on stop. Anything else in `resources/` is left
untouched.

## Lockfile

Only one runner can manage the same FXServer install at a time. On
start, the runner writes `<dataPath>/.nextvm.lock` with its PID.
Trying to start a second `nextvm dev --serve` against the same
server fails fast:

```
✗ Another NextVM runner is already managing this FXServer
  (PID 12345, lockfile at C:\fivem\server-data\.nextvm.lock).
  Stop it first, or delete the lockfile if you're sure it's stale.
```

Stale locks (recorded PID is dead) are silently reclaimed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Could not find an FXServer executable` | `path` is wrong | Point at the folder containing `FXServer.exe` / `run.sh` |
| `FXServer resources directory not found` | `dataPath` doesn't have `resources/` | Set `dataPath` to your `cfx-server-data` clone |
| `Cannot use import statement outside a module` from a module bundle | Stale build artifacts from before NextVM 0.0.x | Delete `dist/` in every module and rerun |
| `Access denied for command ensure` in FX logs | The dev-bridge convar+ACL aren't being emitted | Make sure you're on the latest `@nextvm/fxserver-runner` |
| Two `FXServer.exe` processes survive after `Ctrl+C` (Windows) | Pre-tree-kill build | Update to the latest `@nextvm/fxserver-runner` |
| `EPERM: operation not permitted, symlink` (Windows) | Developer Mode off + non-admin shell | The linker auto-falls back to a recursive copy. Slower but works. |
| `No license key set — server will run in offline mode` | `CFX_LICENSE_KEY` env var missing | Either set it, or accept offline mode for local dev |

## CLI flags

```
nextvm dev              # watcher only, no FXServer (manage externally)
nextvm dev --serve      # watcher + FXServer subprocess + ensure bridge
nextvm serve            # one-shot: build + FXServer, no watcher
nextvm serve --no-build # serve but skip the build step (use existing dist/)
```

## Why NextVM doesn't install FXServer

1. FXServer is a 200+ MB binary you only need to download once.
2. Pinning a specific FXServer version inside the framework couples
   our release cadence to FiveM client updates and creates a bad
   failure mode when they break.
3. Every FiveM developer already has FXServer installed for any
   other framework they touch (ESX, QBCore, ox_core, etc.) — asking
   them to redo it for NextVM would be friction without value.
4. The `cfx-server-data` baseline is updated independently of any
   framework and is a single `git clone` away.

NextVM owns the parts that benefit from automation: config
generation, module linking, log streaming, hot reload. Everything
else is left as a one-time bring-your-own setup.
