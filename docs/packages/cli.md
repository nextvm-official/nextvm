# @nextvm/cli

The `nextvm` command-line tool. A thin wrapper over `@nextvm/build`,
`@nextvm/db`, `@nextvm/registry`, and `@nextvm/migration`.

## Install

```bash
pnpm add -D @nextvm/cli
```

This adds a `nextvm` binary to `node_modules/.bin/`. Use it directly
in your scripts:

```json
{
  "scripts": {
    "dev": "nextvm dev",
    "build": "nextvm build",
    "test": "vitest run",
    "validate": "nextvm validate"
  }
}
```

## Commands

| Command | Status | See |
|---|---|---|
| `nextvm create <name>` | ✅ full | [create](/cli/create) |
| `nextvm add <name> [--full\|--blank]` | ✅ full | [add](/cli/add) |
| `nextvm validate` | ✅ full | [validate](/cli/validate) |
| `nextvm docs` | ✅ full | [docs](/cli/docs) |
| `nextvm build` | ✅ full | [build](/cli/build) |
| `nextvm dev` | ✅ full | [dev](/cli/dev) |
| `nextvm db:migrate` | ✅ full | [db](/cli/db) |
| `nextvm db:rollback` | ✅ full | [db](/cli/db) |
| `nextvm db:generate` | ⚠ stub | [db](/cli/db) |
| `nextvm db:seed` | ⚠ stub | [db](/cli/db) |
| `nextvm migrate:from esx\|qbcore` | ✅ full | [migrate-from](/cli/migrate-from) |
| `nextvm registry:search <query>` | ✅ full | [registry](/cli/registry) |
| `nextvm registry:publish` | ✅ full | [registry](/cli/registry) |
| `nextvm deploy` | ⚠ stub | [deploy](/cli/deploy) |
| `nextvm perf` | ⚠ stub | [perf](/cli/perf) |

The stubs (`db:generate`, `db:seed`, `deploy`, `perf`) print clear
"not yet implemented" messages with the reason — they're either
deferred to Phase 3 (SaaS hosting) or pending sub-features that
need backend services.

## Programmatic API

The CLI also exports `createCli()` and `runCli()` for embedding:

```typescript
import { createCli, runCli } from '@nextvm/cli'

// Run with custom argv
await runCli(['nextvm', 'build', '--quiet'])

// Or build the commander Program for further customization
const program = createCli()
program.addCommand(myCustomCommand)
program.parseAsync()
```

## See also

- [Full CLI reference](/cli/create)
- [`@nextvm/build`](/packages/build)
- [`@nextvm/registry`](/packages/registry)
- [`@nextvm/migration`](/packages/migration)
