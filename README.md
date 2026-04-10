# NextVM

> A next-generation **TypeScript-first** framework for **FiveM** servers.

[![CI](https://github.com/nextvm-official/nextvm/actions/workflows/ci.yml/badge.svg)](https://github.com/nextvm-official/nextvm/actions/workflows/ci.yml)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-orange.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-22.x-brightgreen.svg)](https://nodejs.org)

NextVM replaces ESX, QBCore and ox_core with a modern, type-safe, modular
architecture. Strict TypeScript everywhere, Zod-validated RPCs, dependency
injection, and a build pipeline that turns one repository into ready-to-`ensure`
FiveM resources.

## Highlights

- 🟦 **TypeScript strict mode** — full type safety from server to NUI
- 🧩 **Module system** with 9 lifecycle hooks, DI, and adapter pattern
- 🛡️ **13 architecture guards** enforced by `nextvm validate`
- 🔁 **Typed RPC** (tRPC-style) with Zod input validation + rate limiting
- 🎭 **Character-scoped state** keyed by `charId`, never `source`
- 🪝 **Managed tick scheduler** with per-frame budget + priorities
- 🏗️ **Build pipeline**: tsup + auto-`fxmanifest.lua` + locale bundling
- 🔥 **Dev mode** spawns a local FXServer subprocess, hot-reloads modules on save, preserves player state across reloads
- 🔧 **`@nextvm/fxserver-runner`** generates `server.cfg`, links modules into `resources/[nextvm]/`, streams logs, cleans up on Ctrl+C
- 🎤 **Voice service** on top of `pma-voice` with ACL'd radio channels
- 🎨 **NUI bridge** with React hooks + Vite plugin (HMR-ready)
- 🧰 **6 first-party modules**: banking, jobs, housing, inventory, player, vehicle
- 🤝 **ESX/QBCore compatibility layer** for gradual migration
- 💸 **PLA-compliant** Tebex integration

## Quick start

```bash
# 1. Scaffold a project (with the starter template)
pnpm create nextvm@latest my-server --template starter
cd my-server
pnpm install

# 2. Point it at your local FXServer (one-time setup — bring your own FXServer)
echo "FXSERVER_PATH=C:/fivem/server" >> .env
echo "CFX_LICENSE_KEY=cfxk_…"        >> .env

# 3. Run the dev loop — builds modules, spawns FXServer, hot-reloads on save
pnpm nextvm dev --serve
```

Connect to `localhost:30120` from your FiveM client to verify. Edit any
file under `modules/<name>/src/` and the runner rebuilds in ~10ms,
runs `ensure <module>` inside FXServer, and preserves connected player
state across the reload.

Don't have FXServer installed yet, or prefer to deploy elsewhere? See
the [Local FXServer guide](./docs/guide/local-fxserver.md) for the
one-time setup, or skip the `--serve` flag and use the manual
[build-and-copy flow](./docs/guide/installation.md#_6-alternative-manual-deploy-without-dev-serve).

For the full walkthrough see the [End-to-End Quickstart](./docs/guide/end-to-end.md)
or the [Full Stack Example](./examples/full-stack).

## Documentation

The full docs site is built from [`docs/`](./docs) with VitePress:

```bash
pnpm install
pnpm docs:dev
```

Or browse the rendered version on the [GitHub Pages site](https://nextvm-official.github.io/nextvm/) once it's published.

Reading order if you're new:
1. [Getting Started](./docs/guide/getting-started.md)
2. [Installation](./docs/guide/installation.md) — bring-your-own FXServer setup
3. [Local FXServer](./docs/guide/local-fxserver.md) — `dev --serve` reference
4. [Architecture Overview](./docs/guide/architecture-overview.md)
5. [Module Authoring](./docs/guide/module-authoring.md)
6. [End-to-End Quickstart](./docs/guide/end-to-end.md)

## Packages

| Layer | Package | Purpose |
|---|---|---|
| **Natives** | [`@nextvm/natives`](./packages/natives) | Typed wrappers around FiveM natives |
| **Core** | [`@nextvm/core`](./packages/core) | DI, RPC, State, Lifecycle, Tick, Errors |
| Core | [`@nextvm/db`](./packages/db) | Typed query builder + migrations + MySQL adapter |
| Core | [`@nextvm/i18n`](./packages/i18n) | Type-safe locale system |
| Core | [`@nextvm/test-utils`](./packages/test-utils) | Mock context, harness, in-memory repos |
| **Tooling** | [`@nextvm/cli`](./packages/cli) | `nextvm` command line |
| Tooling | [`@nextvm/build`](./packages/build) | Project loader + build orchestrator + dev mode |
| Tooling | [`@nextvm/fxserver-runner`](./packages/fxserver-runner) | Spawn + manage a local FXServer subprocess for dev |
| Tooling | [`@nextvm/vite-plugin-nui`](./packages/vite-plugin-nui) | Vite plugin for NUI apps |
| **Integrations** | [`@nextvm/discord`](./packages/discord) | Discord webhooks + RCON + txAdmin events |
| Integrations | [`@nextvm/compat`](./packages/compat) | ESX + QBCore exports |
| Integrations | [`@nextvm/tebex`](./packages/tebex) | PLA-compliant Tebex webhook handler |
| Integrations | [`@nextvm/registry`](./packages/registry) | Module marketplace client |
| Integrations | [`@nextvm/migration`](./packages/migration) | ESX/QBCore migration toolkit |
| **Runtime** | [`@nextvm/runtime-server`](./packages/runtime-server) | Server-side bootstrap |
| Runtime | [`@nextvm/runtime-client`](./packages/runtime-client) | Client-side bootstrap |
| Runtime | [`@nextvm/nui`](./packages/nui) | Typed NUI message bus |
| Runtime | [`@nextvm/nui-react`](./packages/nui-react) | React hooks for the NUI bridge |
| Runtime | [`@nextvm/voice`](./packages/voice) | Server-authoritative voice service |

## First-party modules

[`@nextvm/banking`](./modules/banking) ·
[`@nextvm/jobs`](./modules/jobs) ·
[`@nextvm/housing`](./modules/housing) ·
[`@nextvm/inventory`](./modules/inventory) ·
[`@nextvm/player`](./modules/player) ·
[`@nextvm/vehicle`](./modules/vehicle)

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
before opening a PR. By participating in this project you agree to abide
by our [Code of Conduct](./CODE_OF_CONDUCT.md).

For security issues, please follow [SECURITY.md](./SECURITY.md) — do not
file public issues.

## License

NextVM is licensed under the [Business Source License 1.1](./LICENSE)
(BUSL-1.1) — the same license used by HashiCorp, MariaDB, CockroachDB,
and Sentry.

**What you can do (free, no permission needed):**

- ✅ Run NextVM on your own FiveM server, including commercially
  (donations, premium ranks, paid cosmetics consistent with the
  Cfx.re PLA)
- ✅ Build, distribute, and sell NextVM modules
- ✅ Fork, modify, contribute back
- ✅ Install NextVM on a single client's infrastructure as a
  consultant
- ✅ Use NextVM in classroom / educational settings

**What requires a commercial license from the maintainers:**

- ❌ Operating a multi-tenant hosting platform where third parties
  can sign up to deploy NextVM-based servers without managing the
  underlying infrastructure themselves (e.g. "Managed NextVM
  Hosting as a Service")

**Time-bombed open source:** every released version of NextVM
automatically converts to **Apache License 2.0** four years after
its release. So a version released today becomes fully Apache 2.0
in 2030 — no questions asked, no maintainer approval needed.

For commercial licensing inquiries see [the security contact](./SECURITY.md)
or open a GitHub Discussion.

## Acknowledgments

NextVM stands on the shoulders of years of community work in ESX,
QBCore, ox_core, pma-voice, txAdmin, and the broader Cfx.re ecosystem.
Thank you to everyone who pushed FiveM scripting forward.
