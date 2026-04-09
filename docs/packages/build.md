# @nextvm/build

The build orchestrator behind `nextvm build` and `nextvm dev`. Loads
the project, runs tsup per module, generates `fxmanifest.lua`,
bundles locales, and watches for changes in dev mode.

## Install

```bash
pnpm add -D @nextvm/build
```

## loadProject

```typescript
import { loadProject } from '@nextvm/build'

const project = await loadProject(process.cwd())
// → {
//     rootDir: '/abs/path/to/project',
//     config: { server: {...}, database: {...}, modules: [...] },
//     modules: [{ name: '@nextvm/banking', version, path, ... }, ...]
//   }
```

`loadProject` reads `nextvm.config.ts` via jiti (no compile step
needed), validates it against the project config schema, and
discovers every module under `modules/*` with a `package.json`.

## projectConfigSchema

The Zod schema applied to `nextvm.config.ts`:

```typescript
{
  server: {
    name: string (default 'NextVM Server'),
    maxPlayers: int (default 32),
    defaultLocale: string (default 'en'),
  },
  database: {
    host: string (default 'localhost'),
    port: int (default 3306),
    user: string (default 'root'),
    password: string (default ''),
    database: string (default 'nextvm'),
  },
  modules: string[] (default [] meaning "include everything"),
}
```

## runBuild

```typescript
import { loadProject, runBuild } from '@nextvm/build'

const project = await loadProject()
const result = await runBuild(project, { verbose: true })

// result: {
//   totalDurationMs: 82,
//   modules: [{ module, durationMs, bundledServer, bundledClient, locales, warnings }],
//   warnings: [],
//   errors: [],
// }
```

For each discovered module the orchestrator:

1. Resolves entry points (`src/server/index.ts`, `src/client/index.ts`,
   or single `src/index.ts` for shared)
2. Runs tsup with `format: 'esm'` and `outExtension: '.js'`
3. Externalizes every workspace dep so the bundle is lean
4. Generates `fxmanifest.lua` next to `dist/`
5. Bundles `src/shared/locales/*.ts` into `dist/locales/*.json`
6. Validates locale completeness and adds warnings for missing keys

## runDev

```typescript
import { loadProject, runDev } from '@nextvm/build'

const project = await loadProject()
const session = await runDev(project, {
  onModuleRebuilt: async (mod) => {
    console.log(`${mod.name} rebuilt — restart resource`)
  },
})

// Stop on SIGINT
process.on('SIGINT', () => session.stop())
```

`runDev` performs an initial full build, then watches each module's
`src/` via chokidar. On change, it rebuilds the affected module
(`skipLocales: true` for speed) and fires the optional
`onModuleRebuilt` callback.

## generateFxmanifest

```typescript
import { generateFxmanifest } from '@nextvm/build'

const lua = generateFxmanifest(module, {
  hasServer: true,
  hasClient: true,
  dependencies: ['nextvm-core', 'nextvm-natives'],
  requireLua54: false,
})
```

The output is a standard `cerulean` manifest:

```lua
fx_version 'cerulean'
games { 'gta5' }
author 'NextVM'
description 'Banking module — Phase 2'
version '0.1.0'

server_script 'dist/server.js'
client_script 'dist/client.js'

files {
  'dist/**/*',
  'locales/**/*',
}

dependencies {
  'nextvm-core',
  'nextvm-natives',
}
```

## bundleLocales

```typescript
import { bundleLocales } from '@nextvm/build'

const result = bundleLocales(module)
// → {
//     module: '@nextvm/banking',
//     bundled: [{ locale: 'en', keys: 4, path }],
//     missingKeys: [{ locale: 'de', key: 'banking.new_field' }],
//   }
```

The bundler reads every `src/shared/locales/*.ts` file via a
regex-based extractor (handles flat `defineLocale({ ... })` literals,
which is the official module template), writes JSON to
`dist/locales/`, and validates completeness against the base locale.

## Tests

`packages/build/__tests__/` contains 16 tests covering the project
loader, fxmanifest generator, and locale bundler against tmpdir
fixtures. Run via `pnpm --filter @nextvm/build test`.

## See also

- [Concept Chapter 15](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
- [`nextvm build`](/cli/build) and [`nextvm dev`](/cli/dev) commands
