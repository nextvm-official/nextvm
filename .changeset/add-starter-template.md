---
"create-nextvm": minor
---

Add `--template starter` flag to `create-nextvm`. The starter template
scaffolds a working NextVM server in one command:

```bash
pnpm create nextvm@latest my-server --template starter
cd my-server
pnpm install
pnpm dev
```

Generated layout:

- `modules/core` — bootstrap module that calls `bootstrapServer` /
  `bootstrapClient` and registers every other module
- `modules/shop` — example custom module demonstrating the layered
  pattern (`src/server/service.ts` + `src/server/router.ts`),
  cross-module DI to `@nextvm/banking`, and unit tests via vitest
- `nextvm.config.ts` — pre-filled with all first-party modules listed
- `package.json` — runtime + dev deps including `@nextvm/banking`,
  `jobs`, `housing`, `inventory`, `player`, `vehicle`, plus `vitest`
  for the example module's tests

The blank template is still the default (`--template blank` or no
flag). Existing scaffolds are unaffected.

Also adds a `RegisterCommand('shop_list', ...)` example to the
generated client bootstrap so users have something concrete to type
into their FXServer console after `ensure`-ing the modules.
