# Getting Started

NextVM is a TypeScript-first framework for FiveM. It replaces ESX, QBCore,
and ox_core with a layered, type-safe, test-driven architecture and the
build pipeline you'd expect from a modern Node.js project.

This page is a 5-minute tour. After it you'll know:

- What NextVM gives you out of the box
- How a NextVM project is laid out
- Where to go next depending on what you want to build

## What's in the box

NextVM ships as a monorepo of 18 packages, grouped by layer:

| Layer | Packages |
|---|---|
| **Layer 2 — Natives** | `@nextvm/natives` |
| **Layer 3 — Core** | `@nextvm/core`, `@nextvm/db`, `@nextvm/i18n`, `@nextvm/test-utils` |
| **Layer 3 — Tooling** | `@nextvm/build`, `@nextvm/cli` |
| **Layer 3 — Integrations** | `@nextvm/discord`, `@nextvm/compat`, `@nextvm/tebex`, `@nextvm/registry`, `@nextvm/migration` |
| **Layer 4 — First-party Modules** | `@nextvm/player`, `@nextvm/vehicle`, `@nextvm/inventory`, `@nextvm/banking`, `@nextvm/jobs`, `@nextvm/housing` |

The layer model is enforced by
Layer 4 modules cannot call FiveM natives directly — they go through
`@nextvm/natives`. Layer 3 services cannot import each other across
modules — they go through DI.

## Project layout

A NextVM server looks like this:

```
my-server/
├── nextvm.config.ts          # Server name, DB connection, modules to load
├── package.json
├── tsconfig.json
└── modules/
    ├── banking/              # @nextvm/banking
    ├── jobs/                 # @nextvm/jobs
    └── my-custom-module/     # Your code
```

Every module under `modules/*` is a workspace package with its own
`src/`, `__tests__/`, and `package.json`. The framework discovers them
automatically when you run `nextvm build` or `nextvm dev`.

## Three commands to a running server

```bash
pnpm create nextvm@latest my-server --template starter
cd my-server && pnpm install
pnpm nextvm dev --serve
```

The scaffold downloads FXServer automatically. No manual setup needed
— just Node.js and pnpm. Connect with FiveM on `localhost:30120`.

What happens behind the scenes:

- FXServer binary + cfx-server-data are downloaded into `.fxserver/`
- Every module under `modules/*` gets built to `dist/`
- The runner links them into `resources/[nextvm]/`
- A fresh `server.cfg.nextvm` is generated from `nextvm.config.ts`
- FXServer spawns as a subprocess and streams logs into your terminal
- File changes trigger a rebuild + `ensure <module>` inside FXServer
- `Ctrl+C` shuts everything down cleanly

The full setup walkthrough is on the
[Installation page](/guide/installation). For FiveM concepts
(resources, convars, ACL, OneSync) see
[FiveM Server Basics](/guide/fivem-basics).

## Where to go next

Depending on what you want to do:

- **Set up a real FXServer with NextVM** → [Installation](/guide/installation)
- **Wire `nextvm dev --serve` against your local FXServer** → [Local FXServer](/guide/local-fxserver)
- **Build your first module from scratch** → [Your First Module](/guide/your-first-module)
- **Understand how modules are structured** → [Module Authoring](/guide/module-authoring)
- **Migrate an existing ESX server** → [Migration from ESX](/guide/migration-from-esx)
- **Sell items to players** → [PLA Compliance](/guide/pla-compliance)
- **Look up a specific package** → [Packages](/packages/core)
- **Look up a CLI command** → [CLI Reference](/cli/create)
- **Understand the architecture** → [Concept Overview](/concept/)

## How NextVM compares

| | ESX | QBCore | NextVM |
|---|---|---|---|
| Language | Lua | Lua | **TypeScript** |
| Type safety | ❌ | ❌ | ✅ |
| Build pipeline | Manual | Manual | ✅ tsup + tree-shaking |
| Generated fxmanifest | ❌ | ❌ | ✅ from `defineModule` |
| Config validation | ❌ | ❌ | ✅ Zod at startup |
| RPC system | string events | string events | ✅ tRPC-style |
| Inter-module deps | direct imports | direct imports | ✅ DI / events |
| Tests | rare | rare | ✅ 213 in framework |
| i18n | bolt-on | bolt-on | ✅ first-class |
| Tick budget | manual | manual | ✅ HIGH/MEDIUM/LOW priority |
| Migration toolkit | n/a | n/a | ✅ ESX + QBCore |
| PLA compliance | unclear | unclear | ✅ explicit + Tebex bridge |
