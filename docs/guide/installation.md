# Installation

NextVM is split into two install paths: the **CLI + framework** that you
develop against, and the **FXServer setup** that runs the compiled output.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22+ | The CLI and framework target Node 22 LTS |
| pnpm | 9+ | Required (NextVM is a pnpm workspace) |
| FXServer | recent build | Cfx.re's FiveM server, with a Cfx.re License Key |
| MySQL / MariaDB | 8+ | Required for the character system |
| txAdmin | bundled with FXServer | Recommended for managing the server |

## 1. Create a NextVM project

```bash
nextvm create my-server
cd my-server
pnpm install
```

This produces:

```
my-server/
├── nextvm.config.ts        # Server config + DB connection
├── package.json            # Lists @nextvm/* deps
├── tsconfig.json
├── modules/                # Empty — your modules live here
└── .gitignore
```

The generated `nextvm.config.ts` is a typed config object validated at
startup against the schema in [`@nextvm/build`](/packages/build):

```typescript
export default {
  server: {
    name: 'my-server',
    maxPlayers: 32,
    defaultLocale: 'en',
  },
  database: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'nextvm',
  },
  modules: [],  // empty = include every module under modules/
}
```

## 2. Add modules

You have three ways to add a module:

### A. Use a first-party module

```bash
pnpm add @nextvm/banking @nextvm/jobs @nextvm/housing
```

Then list them in `nextvm.config.ts`:

```typescript
export default {
  // ...
  modules: ['@nextvm/banking', '@nextvm/jobs', '@nextvm/housing'],
}
```

### B. Scaffold a custom module

```bash
nextvm add my-feature --full
```

This creates a fully-layered module under `modules/my-feature/` following
the conventions in [Module Authoring](/guide/module-authoring).

For a one-file prototype use `--blank` instead of `--full`.

### C. Install from the registry

```bash
nextvm add @nextvm-community/loans     # lands with the registry backend
```

## 3. Set up the database

NextVM ships with framework migrations for `nextv_users` and
`nextv_characters`. Apply them with:

```bash
nextvm db:migrate
```

The CLI reads `nextvm.config.ts` for the connection details and runs
every pending migration registered with the project's
`MigrationRunner`.

## 4. Build for FXServer

```bash
nextvm build
```

For each module in `modules/*` this:

1. Compiles TypeScript to JavaScript via tsup
2. Bundles `server.js` and `client.js`
3. Generates `fxmanifest.lua` from the module's `defineModule` metadata
4. Bundles `src/shared/locales/*.ts` into `dist/locales/*.json`
5. Validates locale completeness against the base locale (warns on
   missing keys)

The result is a set of FXServer-ready folders you can drop into your
`resources/` directory.

## 5. FXServer setup

Get an FXServer license key from <https://keymaster.fivem.net/> and
follow the [official server setup guide](https://docs.fivem.net/docs/server-manual/setting-up-a-server/).

Once FXServer is running, copy your built modules into the resources
folder:

```
my-fxserver/
├── server.cfg
└── resources/
    └── [nextvm]/
        ├── nextvm-core/
        ├── nextvm-natives/
        ├── nextvm-player/
        └── ...your modules
```

In `server.cfg` add:

```
# NextVM resources (load order matters — natives first, then core)
ensure pma-voice
ensure nextvm-natives
ensure nextvm-core
ensure nextvm-player
ensure nextvm-banking
# ...

# ACE — seed admin role
add_ace group.nextv_admin nextvm.admin allow
```

## 6. txAdmin Recipe (alternative)

Instead of installing manually, point txAdmin's setup wizard at the
NextVM recipe:

```
https://github.com/nextvm-official/nextvm/raw/main/recipes/nextvm.yaml
```

This downloads NextVM core, sets up MySQL, runs the initial migration,
and installs the default modules in one shot. See the
[`recipes/`](https://github.com/nextvm-official/nextvm/tree/main/recipes) folder
in the repo for the full recipe.

## Verifying your install

```bash
nextvm validate
```

This runs static checks on every module:

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
