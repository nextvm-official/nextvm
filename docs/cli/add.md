# nextvm add

Scaffold a new module or install one from the registry.

## Synopsis

```bash
nextvm add <name> --full
nextvm add <name> --blank
```

## Arguments

| Arg | Required | Description |
|---|---|---|
| `<name>` | yes | Module name (will become `modules/<name>`) |

## Options

| Option | Description |
|---|---|
| `--full` | Layered scaffold following [Module Authoring](/guide/module-authoring) — **recommended** |
| `--blank` | Minimal one-file scaffold for prototyping |

If you pass neither flag, the CLI prints a helpful message saying
the registry install path lands with `@nextvm/registry` in Phase 2
Block K and asks you to pick `--full` or `--blank`.

## --full output

Generates the full layered structure:

```
modules/<name>/
├── src/
│   ├── index.ts                # defineModule wiring
│   ├── server/
│   │   ├── service.ts          # Domain logic
│   │   └── router.ts           # RPC boundary with Zod-validated inputs
│   ├── client/index.ts
│   ├── shared/
│   │   ├── schemas.ts          # Module-shared Zod schemas
│   │   ├── constants.ts        # Event names, ACE permissions
│   │   └── locales/{en,de}.ts
│   └── adapters/README.md      # Cross-module adapter pattern guide
├── __tests__/
│   ├── service.test.ts         # Pure unit tests
│   └── router.test.ts          # Router tests via createModuleHarness
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

Every file uses the module name in PascalCase identifiers and
contains pointers back to the architecture doc.

## --blank output

Generates a minimal one-file scaffold:

```
modules/<name>/
├── src/
│   ├── index.ts                # Tiny defineModule call
│   └── shared/locales/en.ts
├── __tests__/<name>.test.ts
└── package.json
```

Use this when you want to prototype something fast and don't want to
worry about layers yet.

## Example

```bash
# Layered (recommended for any non-trivial module)
nextvm add mailbox --full

# Quick prototype
nextvm add quick-test --blank
```

## See also

- [Your First Module tutorial](/guide/your-first-module)
- [Module Authoring](/guide/module-authoring)
