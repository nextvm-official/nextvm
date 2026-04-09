# NextVM Full-Stack Example

A complete, end-to-end NextVM project showing how every layer of the
framework fits together. Use it as a reference when you're scaffolding
a real server, or as a smoke test against the workspace builds.

## What it demonstrates

| Layer | Files |
|---|---|
| **Project config** | `nextvm.config.ts` |
| **Module bootstrap** | `modules/core/src/server/index.ts`, `modules/core/src/client/index.ts` |
| **Runtime wiring** | `bootstrapServer` + state snapshot + dev bridge + compat + voice service |
| **Game modules** | banking + jobs + housing + inventory + player + vehicle (all first-party) |
| **NUI** | `modules/core/nui/` — Vite + React + `@nextvm/nui-react` hooks |
| **Vite plugin** | `@nextvm/vite-plugin-nui` for HMR + fxmanifest snippet |
| **DB** | `@nextvm/db` `DbCharacterRepository` against MySQL (or in-memory fallback) |

## Layout

```
examples/full-stack/
├── README.md
├── nextvm.config.ts          # project config
├── package.json
├── tsconfig.json
├── modules/
│   └── core/                 # the bootstrap module
│       ├── package.json
│       ├── src/
│       │   ├── index.ts       # defineModule entry
│       │   ├── server/
│       │   │   └── index.ts   # bootstrapServer wiring
│       │   └── client/
│       │       └── index.ts   # bootstrapClient + NUI mount
│       └── nui/
│           ├── index.html
│           ├── vite.config.ts
│           └── src/
│               ├── main.tsx
│               └── App.tsx
└── server.cfg                # FXServer entries
```

## Running it

### 1. Build the workspace

From the repo root:

```bash
pnpm install
pnpm build
```

### 2. Build the example's NUI

```bash
cd examples/full-stack/modules/core/nui
pnpm install
pnpm build
```

This produces `dist/` plus a `fxmanifest.nui.lua` snippet.

### 3. Build every NextVM module

```bash
cd ../../..
nextvm build
```

### 4. Drop into your FXServer

Copy the `examples/full-stack/` folder into your `resources/` directory
(or symlink it). Add to `server.cfg`:

```cfg
ensure nextvm-banking
ensure nextvm-jobs
ensure nextvm-housing
ensure nextvm-inventory
ensure nextvm-player
ensure nextvm-vehicle
ensure nextvm-core
```

Order matters: `core` must come last because it bootstraps the runtime
and depends on every other module being registered first.

### 5. Iterate with `nextvm dev`

```bash
nextvm dev
```

Edit a file in any module's `src/`, the dev orchestrator rebuilds and
writes `.nextvm/dev-trigger.json`. The runtime watches that file and
runs `ExecuteCommand('ensure <module>')` automatically. State is
preserved across the restart by the snapshot mechanism — your test
character keeps cash, inventory, jobs, position.

## Reading order

If you've never seen a NextVM project before, read in this order:

1. [`nextvm.config.ts`](./nextvm.config.ts) — project surface
2. [`modules/core/src/index.ts`](./modules/core/src/index.ts) — what `defineModule` looks like
3. [`modules/core/src/server/index.ts`](./modules/core/src/server/index.ts) — `bootstrapServer` wiring
4. [`modules/core/src/client/index.ts`](./modules/core/src/client/index.ts) — `bootstrapClient` + NUI mount
5. [`modules/core/nui/src/App.tsx`](./modules/core/nui/src/App.tsx) — React side using `@nextvm/nui-react`

## See also

- [`/guide/end-to-end`](../../docs/guide/end-to-end.md) — narrative walkthrough
- [`/packages/runtime-server`](../../docs/packages/runtime-server.md)
- [`/packages/runtime-client`](../../docs/packages/runtime-client.md)
- [`/packages/nui-react`](../../docs/packages/nui-react.md)
