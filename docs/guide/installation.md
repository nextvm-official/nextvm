# Installation

From zero to a running server in three commands:

```bash
pnpm create nextvm@latest my-server --template starter
cd my-server
pnpm install
pnpm nextvm dev --serve
```

The scaffold automatically downloads the FXServer binary and baseline
resources. You just need Node.js, pnpm, and optionally a Cfx.re
license key.

## Prerequisites

| Tool | Version | How to get it |
|---|---|---|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) — pick the LTS version |
| pnpm | 9+ | `npm install -g pnpm` |
| Git | any | [git-scm.com](https://git-scm.com) |

That's it. FXServer and cfx-server-data are downloaded automatically
during the scaffold step.

## Step 1 — Create your project

```bash
pnpm create nextvm@latest my-server --template starter
```

This:

1. Scaffolds your project files (modules, config, tsconfig)
2. Downloads the latest recommended **FXServer build** (~85 MB) from
   the [Cfx.re artifact API](https://runtime.fivem.net/artifacts/fivem/)
3. Downloads the **cfx-server-data** baseline (mapmanager,
   sessionmanager, spawnmanager, etc.) from GitHub
4. Asks for your **Cfx.re license key** (press Enter to skip for
   offline/LAN mode)

Everything lands in a single folder:

```
my-server/
├── .fxserver/                   ← auto-downloaded, gitignored
│   ├── artifacts/               ← FXServer.exe + DLLs
│   ├── data/                    ← cfx-server-data (resources/)
│   └── .build                   ← build number (e.g. "25770")
├── modules/
│   ├── core/                    ← Bootstrap module
│   └── shop/                    ← Demo shop with service + router + tests
├── nextvm.config.ts             ← Server config (relative .fxserver/ paths)
├── .env                         ← CFX_LICENSE_KEY only
├── .gitignore                   ← .fxserver/ excluded
└── package.json
```

::: info License key
Get yours at [keymaster.fivem.net](https://keymaster.fivem.net).
Without a key the server runs in **offline mode** — you can still
connect via `localhost:30120` but it won't appear in the public
server list. You can add the key to `.env` later at any time.
:::

## Step 2 — Install dependencies

```bash
cd my-server
pnpm install
```

## Step 3 — Start the dev loop

```bash
pnpm nextvm dev --serve
```

You should see:

```
▲ NextVM v0.1.0
dev — watching modules for changes

  › Initial build of 2 module(s)…
  ✓ Initial build completed in 64ms

  [runner] Resolved FXServer binary: .fxserver/artifacts/FXServer.exe
  [runner] Linked 2 module(s) (symlinks)
  [runner] FXServer started (PID 12345)
  ✓ FXServer running (PID 12345)
  ✓ Watching 2 modules for changes
  Press Ctrl+C to stop.

  [fx] [resources] Found 27 resources.
  [fx] [svadhesive] Server license key authentication succeeded.
  [fx] [resources] Started resource core
  [fx] [resources] Started resource shop
```

## Step 4 — Join your server

1. Open **FiveM** (not GTA V directly)
2. Click **Direct Connect** in the top bar
3. Type `localhost:30120` and click **Connect**
4. You're in

## Step 5 — Edit and hot-reload

While connected in-game:

1. Open `modules/shop/src/server/service.ts` in your editor
2. Change something (a price, a log message)
3. Save the file
4. In your terminal:
   ```
   ● Rebuilding shop…
   ✓ shop rebuilt in 26ms
   [runner] ensure shop (via stdin)
   [fx] Stopping resource shop
   [fx] Started resource shop
   ```
5. Module reloaded — you stay connected

`Ctrl+C` in the terminal stops everything cleanly.

---

## Next steps

- **Add a custom module**: `pnpm nextvm add my-feature --full`
- **Add first-party modules**: `pnpm add @nextvm/banking @nextvm/jobs`
- **Set up a database**: [optional database setup](#optional-set-up-the-database)
- **Understand FiveM**: [FiveM Server Basics](/guide/fivem-basics)
- **Understand NextVM**: [Architecture Overview](/guide/architecture-overview)

---

## Flags and alternatives

### Already have FXServer installed?

Point the scaffold at your existing installation instead of downloading:

```bash
pnpm create nextvm@latest my-server --template starter \
  --fxserver-path C:\fivem\server \
  --fxserver-data C:\fivem\server-data
```

### Don't want the FXServer download?

```bash
pnpm create nextvm@latest my-server --template starter --no-fxserver
```

Then configure `FXSERVER_PATH` and `FXSERVER_DATA_PATH` in `.env`
manually. See [Local FXServer](/guide/local-fxserver) for details.

### Blank template (no starter modules)

```bash
pnpm create nextvm@latest my-server --template blank
```

### CI / non-interactive

```bash
pnpm create nextvm@latest my-server --template starter --yes
```

Skips prompts, accepts all defaults (no license key).

---

## (Optional) Set up the database

If your modules use `@nextvm/db` (banking, jobs, housing, inventory,
player all do), you need a MySQL/MariaDB instance:

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

Without a database, the runtime uses an in-memory character
repository — fine for testing but data won't survive a restart.

## (Alternative) Manual deploy

For production or when managing FXServer externally (txAdmin, remote
box), use the build-and-copy flow:

```bash
pnpm nextvm build
pnpm nextvm deploy --target /path/to/fxserver/resources
```

See [Local FXServer → CLI flags](/guide/local-fxserver#cli-flags).

## (Alternative) txAdmin Recipe

Point txAdmin's setup wizard at:

```
https://github.com/nextvm-official/nextvm/raw/main/recipes/nextvm.yaml
```

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
