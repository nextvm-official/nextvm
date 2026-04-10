# Installation

NextVM is split into two install paths: the **CLI + framework** that you
develop against, and the **FXServer** binary that runs the compiled
output. The framework manages the first; you bring your own FXServer.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22+ | The CLI and framework target Node 22 LTS |
| pnpm | 9+ | Required (NextVM is a pnpm workspace) |
| FXServer | recent build | [Download from runtime.fivem.net](https://runtime.fivem.net/artifacts/fivem/) |
| cfx-server-data | latest | `git clone https://github.com/citizenfx/cfx-server-data` |
| Cfx.re License Key | optional for local | [keymaster.fivem.net](https://keymaster.fivem.net) — local dev runs without one in offline mode |
| MySQL / MariaDB | 8+ | Optional — runtime falls back to in-memory if you skip the `database` block |
| txAdmin | bundled with FXServer | Optional — recommended for production-style management |

::: info One-time setup
The FXServer binary, `cfx-server-data`, and license key are
**bring-your-own**. NextVM does not download or install them — that's
deliberately out of scope so we don't pin the framework to a specific
FXServer build. See the [Local FXServer guide](/guide/local-fxserver)
for the rationale.
:::

## 1. Scaffold a project

```bash
pnpm create nextvm@latest my-server --template starter
cd my-server
pnpm install
```

This produces:

```
my-server/
├── nextvm.config.ts        # Server config + DB connection + fxserver block
├── .env.example            # FXSERVER_PATH + CFX_LICENSE_KEY placeholders
├── package.json            # Lists @nextvm/* deps
├── tsconfig.json
├── modules/                # Pre-wired with shop + core starter modules
└── .gitignore
```

The generated `nextvm.config.ts` includes a conditional `fxserver`
block that activates when you set `FXSERVER_PATH`:

```typescript
export default {
  server: {
    name: 'my-server',
    maxPlayers: 32,
    defaultLocale: 'en',
  },
  database: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: 3306,
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DB ?? 'nextvm',
  },
  modules: [],
  fxserver: process.env.FXSERVER_PATH
    ? {
        path: process.env.FXSERVER_PATH,
        licenseKey: process.env.CFX_LICENSE_KEY,
        endpoint: '0.0.0.0:30120',
        gameBuild: 3095,
        additionalResources: [],
        convars: {},
      }
    : undefined,
}
```

## 2. Configure the FXServer integration

Copy the example env file and fill in your local paths:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Absolute path to the folder containing FXServer.exe / run.sh
FXSERVER_PATH=C:/fivem/server

# Get yours at https://keymaster.fivem.net — leave empty for offline dev
CFX_LICENSE_KEY=cfxk_…
```

::: tip Split layouts (cfx-server-data)
The standard FiveM artifact has `FXServer.exe` in `server/` and
`resources/` in `server-data/cfx-server-data/`. For that layout, add
a `dataPath` field to the `fxserver` block in `nextvm.config.ts`:

```typescript
fxserver: {
  path: process.env.FXSERVER_PATH,                // server/
  dataPath: process.env.FXSERVER_DATA_PATH,       // server-data/cfx-server-data/
  // ...
}
```

The runner uses `path` for the binary and `dataPath` for `resources/`
plus the spawn cwd. If you don't set `dataPath`, both default to `path`
(all-in-one layout).
:::

The full fxserver-block reference is in
[Local FXServer](/guide/local-fxserver).

## 3. Add modules

Three ways to add a module:

### A. Use a first-party module

```bash
pnpm add @nextvm/banking @nextvm/jobs @nextvm/housing
```

Then list them in `nextvm.config.ts`:

```typescript
modules: ['@nextvm/banking', '@nextvm/jobs', '@nextvm/housing'],
```

An empty `modules: []` array means *include every module found under
`modules/*`* — useful while iterating.

### B. Scaffold a custom module

```bash
nextvm add my-feature --full
```

Creates a fully-layered module under `modules/my-feature/` following
the conventions in [Module Authoring](/guide/module-authoring). Use
`--blank` for a one-file prototype.

### C. Install from the registry

```bash
nextvm add @nextvm-community/loans
```

(Lands with the registry backend.)

## 4. (Optional) Set up the database

If your modules use `@nextvm/db`, you need a MySQL/MariaDB instance
reachable from the values in your `database` block. The fastest local
option is a Docker container:

```bash
docker run -d --name nextvm-mariadb \
  -e MARIADB_ROOT_PASSWORD= \
  -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 \
  -e MARIADB_DATABASE=nextvm \
  -p 3306:3306 mariadb:11
```

Then run the framework migrations:

```bash
nextvm db:migrate
```

This creates `nextv_users` and `nextv_characters` plus any module-level
migrations registered with the project's `MigrationRunner`.

If you skip this step, the runtime falls back to an in-memory
character repository — fine for smoke-testing a single resource but
character data won't survive a restart.

## 5. Run the dev loop

```bash
pnpm nextvm dev --serve
```

This:

1. Builds every module under `modules/*`
2. Resolves your FXServer binary
3. Links the modules into `<dataPath>/resources/[nextvm]/`
4. Generates `server.cfg.nextvm` from `nextvm.config.ts` (your
   hand-managed `server.cfg` is left untouched)
5. Spawns FXServer and streams logs into your terminal with a cyan
   `[fx]` prefix
6. Watches every module's `src/` and triggers `ensure <module>` inside
   FXServer on every successful rebuild — connected players keep
   their state via the snapshot mechanism in `@nextvm/runtime-server`
7. On `Ctrl+C`: shuts down the FXServer process tree, removes the
   `[nextvm]/` symlinks, and exits cleanly

Connect to `localhost:30120` from your FiveM client to verify.

The full walkthrough — sample output, troubleshooting matrix, lockfile
behaviour, what gets generated where — is on the [Local FXServer
page](/guide/local-fxserver).

## 6. (Alternative) Manual deploy without `dev --serve`

If you're managing FXServer externally (txAdmin, a remote box,
Pterodactyl), skip step 5 and use the legacy build-and-copy flow:

```bash
nextvm build
```

For each module this produces `dist/server.js`, `dist/client.js`,
`dist/locales/*.json`, and `fxmanifest.lua`. Copy each `modules/<name>/`
folder into your FXServer's `resources/[nextvm]/`:

```
my-fxserver/
├── server.cfg
└── resources/
    └── [nextvm]/
        ├── shop/
        ├── banking/
        └── ...
```

Add the resources to `server.cfg`:

```
ensure shop
ensure banking
# ...

# ACE — seed admin role
add_ace group.nextv_admin nextvm.admin allow
```

`nextvm dev` (without `--serve`) acts as a pure rebuild watcher in
this mode — you handle `ensure` yourself.

## 7. (Alternative) txAdmin Recipe

Instead of installing manually, point txAdmin's setup wizard at the
NextVM recipe:

```
https://github.com/nextvm-official/nextvm/raw/main/recipes/nextvm.yaml
```

This downloads NextVM core, sets up MySQL, runs the initial
migration, and installs the default modules in one shot. See the
[`recipes/`](https://github.com/nextvm-official/nextvm/tree/main/recipes)
folder for the full recipe.

## Verifying your install

```bash
nextvm validate
```

Runs static checks on every module:

- ✓ Each module has `src/index.ts`
- ✓ Each module has `en.ts` locale
- ✓ Each module's RPC mutations have Zod input schemas
- ✓ Modules importing `@nextvm/tebex` ship a `MONETIZATION.md`
- ⚠ Soft-warns when a module isn't using the layered structure
- ⚠ Soft-warns when declared dependencies have no adapter file

A clean output looks like:

```
ℹ Validating NextVM project
✓ nextvm.config.ts found
✓ Found 6 module(s)
✓ Validation passed
```
