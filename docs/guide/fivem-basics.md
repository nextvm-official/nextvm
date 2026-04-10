# FiveM Server Basics

This page explains how a FiveM server works under the hood — what
the parts are, what you can configure, and what NextVM automates
for you. If you're coming from ESX/QBCore, skip to [Convars](#convars)
or [What NextVM automates](#what-nextvm-automates). If you've never
touched FiveM server hosting, start at the top.

## What is FXServer?

FXServer is the server binary built by the [Cfx.re](https://cfx.re)
collective. It hosts a modified GTA V multiplayer instance that
FiveM clients connect to. It's written in C++ and runs on Windows
and Linux.

You download a **server artifact** (a zip file, ~200 MB) from
[runtime.fivem.net](https://runtime.fivem.net/artifacts/fivem/),
unzip it, and point it at a **data directory** that contains your
config and resources. That's the whole install.

## Anatomy of a FiveM server

A standard installation looks like this:

```
my-fivem-server/
├── server/                      ← FXServer binary + DLLs
│   ├── FXServer.exe             (Windows)
│   └── run.sh                   (Linux)
│
├── server-data/                 ← Data directory (git clone of cfx-server-data)
│   ├── server.cfg               ← Main config (you create this for production)
│   ├── resources/               ← All your scripts/modules
│   │   ├── [gamemodes]/
│   │   ├── [managers]/
│   │   ├── [nextvm]/            ← NextVM's managed folder (auto-created)
│   │   │   ├── shop/
│   │   │   └── banking/
│   │   └── pma-voice/
│   └── cache/                   ← FXServer's internal cache (auto-created)
│
└── txData/                      ← txAdmin data (optional)
```

::: info cfx-server-data doesn't include a server.cfg
The [cfx-server-data](https://github.com/citizenfx/cfx-server-data)
repo only ships `resources/` and a README. For development with NextVM,
that's fine — `nextvm dev --serve` generates its own `server.cfg.nextvm`
automatically. For production, you'll write your own `server.cfg`.
:::

::: tip Split vs all-in-one layouts
Some setups put the binary and data in the same folder. Others
split them (the standard cfx-server-data layout). NextVM supports
both — set `fxserver.path` (binary) and optionally
`fxserver.dataPath` (data dir) in `nextvm.config.ts`.
:::

## Resources

A **resource** is a folder inside `resources/` that contains scripts
and a manifest. It's FiveM's equivalent of a "plugin" or "module".

### The lifecycle

| Command | What it does |
|---|---|
| `ensure <name>` | Starts the resource if stopped, **or** restarts it if already running. This is what hot-reload uses. |
| `start <name>` | Starts a stopped resource. Errors if already running. |
| `stop <name>` | Stops a running resource. Fires `onResourceStop` events so scripts can clean up. |
| `restart <name>` | Alias for stop + start. |
| `refresh` | Re-scans the resources directory for new/changed resources. |

When you run `nextvm dev --serve`, the runner sends `ensure <name>`
via FXServer's stdin after every successful rebuild.

### Category folders

Resources can be organized in **category folders** using square
brackets: `resources/[nextvm]/shop/`. FXServer treats the `[nextvm]/`
prefix as a namespace — the resource is still called `shop`, not
`[nextvm]/shop`. Categories keep the resources directory tidy.

NextVM uses `resources/[nextvm]/` exclusively. Everything inside is
managed by the runner (symlinks on start, removed on stop). Your
other resources in `[gamemodes]/`, `[managers]/`, etc. are never
touched.

### fxmanifest.lua

Every resource needs a `fxmanifest.lua` that tells FXServer what to
load:

```lua
fx_version 'cerulean'
games { 'gta5' }

author 'NextVM'
description 'Shop module'
version '0.1.0'

server_script 'dist/server.js'
client_script 'dist/client.js'

files {
  'dist/**/*',
  'locales/**/*',
}
```

| Field | What it means |
|---|---|
| `fx_version` | API version. Always `'cerulean'` for modern resources. |
| `games` | Which game(s) this resource supports. `'gta5'` for FiveM. |
| `server_script` | Server-side JavaScript (runs in Node-like V8 isolate). |
| `client_script` | Client-side JavaScript (runs in the player's GTA process). |
| `files` | Additional files shipped to clients (locales, NUI HTML/JS). |
| `dependencies` | Other resources that must start before this one. |

**NextVM generates this file automatically** via `nextvm build`.
You never write fxmanifest.lua by hand.

## server.cfg

The main config file. FXServer reads it on startup. It's a
line-based format:

```cfg
# Endpoints (what IP:port the server listens on)
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

# Convars (server variables)
sv_hostname "My Server"
sv_maxClients 32
sv_licenseKey "cfxk_..."

# Game settings
sv_enforceGameBuild 3095
sv_scriptHookAllowed 0

# Resources to start
ensure mapmanager
ensure sessionmanager
ensure shop
ensure banking

# ACL (Access Control)
add_ace group.admin command allow
add_principal identifier.fivem:123456 group.admin
```

When you use `nextvm dev --serve`, the runner generates
`server.cfg.nextvm` from `nextvm.config.ts` and tells FXServer to
load it via `+exec server.cfg.nextvm`. Your hand-managed
`server.cfg` is **never overwritten**.

## Convars

Convars (console variables) control server behavior. They're set in
`server.cfg` or via the `nextvm.config.ts` → `fxserver.convars`
block.

### Essential convars

| Convar | Default | What it does |
|---|---|---|
| `sv_hostname` | `"FXServer"` | Server name shown in the server list. Cut off at ~50 chars. |
| `sv_projectName` | *(none)* | Full project name in server list — not truncated. **Set this.** |
| `sv_projectDesc` | *(none)* | Project description shown below the name in server list. |
| `sv_maxClients` | `32` | Maximum connected players. Free keys allow up to 48. |
| `sv_licenseKey` | *(required)* | Your Cfx.re license key from [keymaster.fivem.net](https://keymaster.fivem.net). Without one, the server runs in **offline mode** (LAN only, no server list). |
| `sv_enforceGameBuild` | *(none)* | Forces a specific GTA V DLC build. Common values: `2699` (Tuners), `3095` (Cayo Perico), `3258` (Drug Wars). Higher = more map content but more RAM. |
| `sv_scriptHookAllowed` | `0` | Set to `1` to allow Script Hook (mod menus). **Keep at 0** for production. |
| `sv_endpointprivacy` | `false` | When `true`, hides your server's IP from the API. Players connect via Cfx.re relay instead. |

### Network convars

| Convar | Default | What it does |
|---|---|---|
| `endpoint_add_tcp` | `"0.0.0.0:30120"` | TCP listen address. Change the port if 30120 is taken. |
| `endpoint_add_udp` | `"0.0.0.0:30120"` | UDP listen address. Must match the TCP port. |

::: warning Port forwarding
If players can't find your server, check:
1. **Firewall**: both TCP and UDP on port 30120 must be open
2. **Router**: port forward 30120 TCP+UDP to your machine's LAN IP
3. **sv_licenseKey**: without a valid key, the server won't appear in the public server list
:::

### Setting convars via NextVM

In `nextvm.config.ts`:

```typescript
fxserver: {
  path: process.env.FXSERVER_PATH,
  endpoint: '0.0.0.0:30120',
  gameBuild: 3095,
  convars: {
    sv_projectName: 'My RP Server',
    sv_projectDesc: 'A NextVM-powered roleplay experience',
    onesync: 'on',
  },
}
```

The runner translates these into `set <key> <value>` lines in the
generated `server.cfg.nextvm`.

## OneSync

OneSync is FXServer's state awareness system. Without it, players
only see other players within GTA V's default streaming range
(~300m). With OneSync:

- **All entities are server-authoritative** — the server knows every
  ped, vehicle, and object on the map
- **Routing Buckets** — isolate players into separate "dimensions"
  (useful for housing interiors, jail, instanced missions)
- **Population management** — the server controls NPC spawning,
  not each client independently

### Enabling OneSync

In `nextvm.config.ts`:

```typescript
convars: {
  onesync: 'on',          // or 'legacy' for the older implementation
}
```

Or in a manual `server.cfg`:

```cfg
set onesync on
```

::: tip
OneSync is **recommended** for any serious server. Most modern
resources (including all NextVM first-party modules) assume it's
enabled. The only reason to disable it is for very old Lua scripts
that rely on client-side entity ownership.
:::

## ACL / ACE (Access Control)

FiveM uses an **ACE** (Access Control Entry) system for permissions.

| Concept | Meaning |
|---|---|
| **Principal** | An identity — a player (`identifier.fivem:123456`), a group (`group.admin`), or a resource (`resource.shop`). |
| **ACE** | A permission entry: "this principal is allowed this action". |
| **Inheritance** | A principal can be a member of a group. Groups inherit aces. |

### Example ACL setup in server.cfg

```cfg
# Create an admin group with full command access
add_ace group.admin command allow

# Give the admin group access to NextVM's admin permission
add_ace group.admin nextvm.admin allow

# Assign a specific player to the admin group
add_principal identifier.fivem:123456 group.admin
```

NextVM maps ACE permissions to its own permission system via
`@nextvm/core`'s `PermissionService`. See the
[Permissions concept page](/concept/permissions) for details.

::: info Console ACL
Commands sent via FXServer's console (including stdin, which NextVM
uses for hot-reload) automatically have full admin ACL. That's why
`nextvm dev --serve` doesn't need per-resource `add_ace` entries.
:::

## What NextVM automates

Here's what the framework handles for you vs. what stays manual:

| Aspect | NextVM automates | You do manually |
|---|---|---|
| **fxmanifest.lua** | Generated from `defineModule()` on every build | Nothing — never edit this file |
| **server.cfg** | Generates `server.cfg.nextvm` from `nextvm.config.ts` | Keep your own `server.cfg` for production tweaks |
| **Resources linking** | Symlinks/junctions in `resources/[nextvm]/` | Nothing — created on start, removed on stop |
| **ensure commands** | Sent via stdin on every successful rebuild | Run `ensure <name>` manually if not using `--serve` |
| **Convars** | Set via `fxserver.convars` in config | Add custom convars directly to `server.cfg` |
| **ACL** | `@nextvm/core` PermissionService wraps ACE | Initial admin setup in `server.cfg` |
| **FXServer binary** | Not managed — bring your own | Download + update artifacts yourself |
| **cfx-server-data** | Not managed | `git clone` once, update occasionally |
| **License key** | Read from env var, never committed | Register at keymaster.fivem.net |
| **Database** | Schema migrations via `nextvm db:migrate` | Install MySQL/MariaDB yourself |

## Further reading

- [Local FXServer](/guide/local-fxserver) — the `nextvm dev --serve` setup guide
- [Installation](/guide/installation) — full project setup walkthrough
- [Permissions](/concept/permissions) — NextVM's ACE wrapper
- [FiveM Server Manual](https://docs.fivem.net/docs/server-manual/) — official Cfx.re documentation
- [FiveM Scripting Reference](https://docs.fivem.net/docs/scripting-reference/) — native functions, events, etc.
