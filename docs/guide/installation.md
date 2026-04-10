# Installation

This page walks you from zero to a running NextVM server you can
join in the FiveM client. Total time: ~15 minutes (mostly downloading).

NextVM is split into two separate things:

1. **Your NextVM project** — a Node.js workspace where you write
   TypeScript modules. Lives anywhere you keep code (e.g. `~/projects/`).
2. **Your FXServer installation** — the binary + baseline resources
   that run the compiled output. Lives in a separate folder.

These two are connected via `nextvm.config.ts` which tells the
framework where to find the FXServer.

## Prerequisites

| Tool | Version | How to get it |
|---|---|---|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) — pick the LTS version |
| pnpm | 9+ | `npm install -g pnpm` |
| 7-Zip | any | [7-zip.org](https://7-zip.org) — needed to extract the FXServer artifact |
| Git | any | [git-scm.com](https://git-scm.com) |

## Step 1 — Download the FXServer binary

The FXServer is the game server binary from Cfx.re. You download it
once and update it occasionally when new builds come out.

**Windows:**

1. Open [runtime.fivem.net/artifacts/fivem/build_server_windows/master/](https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/)
2. Click the build marked **"Latest Recommended"** (or the newest at the top)
3. Download `server.7z` (~200 MB)
4. Create a folder for your FiveM installation, e.g. `C:\fivem\`
5. Extract `server.7z` into `C:\fivem\server\` using 7-Zip
6. Verify: `C:\fivem\server\FXServer.exe` should exist

**Linux:**

```bash
mkdir -p ~/fivem/server && cd ~/fivem/server
# Pick the latest build from the page below and replace the URL:
# https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/
wget <URL>/fx.tar.xz
tar xf fx.tar.xz
```

## Step 2 — Clone the cfx-server-data baseline

This is FiveM's standard set of base resources (mapmanager,
sessionmanager, spawnmanager, basic-gamemode, hardcap). Without these,
FXServer boots but players can't spawn.

```bash
cd C:\fivem
git clone https://github.com/citizenfx/cfx-server-data server-data
```

::: warning The clone does NOT include a server.cfg
The cfx-server-data repo only ships `resources/` and a `README.md`.
That's fine — NextVM generates its own `server.cfg.nextvm` automatically
when you run `dev --serve`. You don't need to write a server.cfg by hand
for development.
:::

Your FiveM folder now looks like this:

```
C:\fivem\
├── server\                  ← FXServer binary + DLLs
│   └── FXServer.exe
└── server-data\             ← Baseline resources (from the git clone)
    ├── resources\
    │   ├── [gamemodes]\
    │   ├── [managers]\
    │   └── [system]\
    └── README.md
```

## Step 3 — Get a license key (optional)

A Cfx.re license key lets your server appear in the public FiveM
server list. Without one, the server runs in **offline mode** (LAN
only — you can still connect via `localhost:30120`).

1. Go to [keymaster.fivem.net](https://keymaster.fivem.net)
2. Log in with your Cfx.re account (create one if needed)
3. Click **"Generate a New Server Key"**
4. Server type: leave default. IP: `127.0.0.1` for local dev.
5. Copy the key (starts with `cfxk_`)

You'll paste this into your `.env` in the next steps.

## Step 4 — Create your NextVM project

This is where your TypeScript modules live. **Run this in your
projects folder** (NOT inside the FXServer installation):

```bash
cd ~/projects                  # or wherever you keep code
pnpm create nextvm@latest my-server --template starter
cd my-server
pnpm install
```

This creates:

```
~/projects/my-server/          ← your NextVM project
├── nextvm.config.ts           # Server config + fxserver block
├── .env.example               # FXSERVER_PATH + CFX_LICENSE_KEY
├── package.json
├── tsconfig.json
└── modules/
    ├── core/                  # Pre-wired core module
    └── shop/                  # Demo shop with service + router + tests
```

::: info Your project and FXServer are separate folders
The project (`~/projects/my-server/`) contains your source code.
The FXServer (`C:\fivem\`) is the runtime that executes it. NextVM
connects them via symlinks at dev time — you never copy files around
manually during development.
:::

## Step 5 — Configure the .env

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Absolute path to the folder containing FXServer.exe
FXSERVER_PATH=C:/fivem/server

# Absolute path to the folder containing resources/ (the cfx-server-data clone)
FXSERVER_DATA_PATH=C:/fivem/server-data

# License key (leave empty for offline/LAN mode)
CFX_LICENSE_KEY=cfxk_your_key_here
```

Then open `nextvm.config.ts` and make sure the `fxserver` block reads
both paths:

```typescript
fxserver: process.env.FXSERVER_PATH
  ? {
      path: process.env.FXSERVER_PATH,
      dataPath: process.env.FXSERVER_DATA_PATH,
      licenseKey: process.env.CFX_LICENSE_KEY,
      endpoint: '0.0.0.0:30120',
      gameBuild: 3095,
      additionalResources: [],
      convars: {
        sv_projectName: 'My NextVM Server',
        sv_projectDesc: 'Powered by NextVM',
        onesync: 'on',
      },
    }
  : undefined,
```

::: tip Why two paths?
`FXSERVER_PATH` points at the binary (`FXServer.exe`).
`FXSERVER_DATA_PATH` points at the data folder (`resources/`).
If you have both in the same folder (all-in-one layout), just set
`FXSERVER_PATH` and leave `FXSERVER_DATA_PATH` out — it defaults to
the same path.
:::

## Step 6 — Start the dev loop

```bash
pnpm nextvm dev --serve
```

You should see:

```
▲ NextVM v0.1.0
dev — watching modules for changes

  › Initial build of 2 module(s)…
  ✓ Initial build completed in 64ms

  [runner] Resolved FXServer binary: C:\fivem\server\FXServer.exe
  [runner] Linked 2 module(s) (symlinks)
  [runner] Wrote C:\fivem\server-data\server.cfg.nextvm
  [runner] FXServer started (PID 12345)
  ✓ FXServer running (PID 12345)
  ✓ Watching 2 modules for changes
  Press Ctrl+C to stop.

  [fx] [resources] Found 27 resources.
  [fx] [svadhesive] Server license key authentication succeeded.
  [fx] [resources] Started resource core
  [fx] [resources] Started resource shop
```

## Step 7 — Join your server

1. Open **FiveM** (not GTA V directly)
2. On the main menu, click **Direct Connect** (in the top bar)
3. Type `localhost:30120` and click **Connect**
4. You're in

::: info Offline mode
If you didn't set a license key, FiveM will warn about connecting to
an unlisted server — click through. The server works fine for local
development without a key.
:::

## Step 8 — Hot-reload

While connected in-game:

1. Open `modules/shop/src/server/service.ts` in your editor
2. Change something (e.g. a price or a log message)
3. Save the file
4. In your terminal you'll see:
   ```
   ● Rebuilding shop…
   ✓ shop rebuilt in 26ms
   [runner] ensure shop (via stdin)
   [fx] Stopping resource shop
   [fx] Started resource shop
   ```
5. The module is reloaded — you stay connected, no disconnect

`Ctrl+C` in the terminal stops everything cleanly (FXServer process
tree, symlinks, lockfile).

## What was generated

NextVM never touches your hand-managed `server.cfg` (which doesn't
exist yet anyway). Instead it writes `server.cfg.nextvm` into your
data folder and tells FXServer to use it. This file contains:

- Endpoints (TCP + UDP on port 30120)
- Your convars from `nextvm.config.ts`
- `ensure` lines for each linked NextVM module
- The dev-trigger convar for hot-reload

See [Local FXServer → Anatomy](/guide/local-fxserver#anatomy-of-what-gets-generated)
for a full example.

---

## Next steps

Now that your server is running:

- **Add a custom module**: `pnpm nextvm add my-feature --full`
- **Add first-party modules**: `pnpm add @nextvm/banking @nextvm/jobs`
- **Set up a database**: [Step 4 below](#optional-set-up-the-database)
- **Understand FiveM**: [FiveM Server Basics](/guide/fivem-basics)
- **Understand NextVM**: [Architecture Overview](/guide/architecture-overview)
- **Migrate from ESX/QBCore**: [Migration guides](/guide/migration-from-esx)

---

## (Optional) Set up the database

If your modules use `@nextvm/db` (banking, jobs, housing, inventory,
player all do), you need a MySQL/MariaDB instance. The fastest local
option:

```bash
docker run -d --name nextvm-mariadb \
  -e MARIADB_ROOT_PASSWORD= \
  -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 \
  -e MARIADB_DATABASE=nextvm \
  -p 3306:3306 mariadb:11
```

Then run framework migrations:

```bash
pnpm nextvm db:migrate
```

If you skip this, the runtime uses an in-memory character
repository — fine for testing but data won't survive a restart.

## (Alternative) Manual deploy without dev --serve

If you're managing FXServer externally (txAdmin, remote box,
Pterodactyl):

```bash
pnpm nextvm build
pnpm nextvm deploy --target /path/to/fxserver/resources
```

Then add `ensure <name>` lines to your `server.cfg` for each module.
See [Local FXServer → CLI flags](/guide/local-fxserver#cli-flags) for
all options.

## (Alternative) txAdmin Recipe

Point txAdmin's setup wizard at:

```
https://github.com/nextvm-official/nextvm/raw/main/recipes/nextvm.yaml
```

This downloads NextVM core, sets up MySQL, runs migrations, and
installs the default modules in one shot.

## Verifying your install

```bash
pnpm nextvm validate
```

```
ℹ Validating NextVM project
✓ nextvm.config.ts found
✓ Found 6 module(s)
✓ Validation passed
```
