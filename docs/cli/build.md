# nextvm build

Production build: compile TypeScript → JavaScript per module, generate
`fxmanifest.lua`, bundle locales.

## Synopsis

```bash
nextvm build [--quiet]
```

## Options

| Option | Description |
|---|---|
| `--quiet` | Suppress per-module output |

## What it does

Loads the project (`nextvm.config.ts`), discovers every module under
`modules/*`, and for each module:

1. Resolves entry points (`src/server/index.ts`, `src/client/index.ts`,
   or single `src/index.ts`)
2. Runs tsup with `format: 'esm'` and `outExtension: '.js'`
3. Externalizes every workspace dep so the bundle stays lean
4. Generates `fxmanifest.lua` next to `dist/`
5. Bundles `src/shared/locales/*.ts` → `dist/locales/*.json`
6. Validates locale completeness (warnings on missing keys)
7. Prints a structured per-module summary

## Example output

```
Building 3 module(s)
  ✓ @nextvm/banking (61ms)
  ✓ @nextvm/jobs (12ms)
  ✓ @nextvm/housing (10ms)
✓ Built 3 module(s) in 83ms
```

If a module has locale warnings:

```
  ⚠ @nextvm/banking (65ms)
    ⚠ locale 'de' missing key 'banking.new_field'
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All modules built successfully |
| 1 | At least one module failed to build, or any error occurred |

## Output layout

For each module:

```
modules/<name>/
├── dist/
│   ├── server.js
│   ├── server.js.map
│   ├── client.js
│   ├── client.js.map
│   └── locales/
│       ├── en.json
│       └── de.json
└── fxmanifest.lua
```

Drop the entire `modules/<name>/` folder into your FXServer's
`resources/` directory and `ensure <name>` in `server.cfg`.

## See also

- [`@nextvm/build`](/packages/build) package reference
- [`nextvm dev`](/cli/dev) for the watch loop
- [Concept Chapter 15.1](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
