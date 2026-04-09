# nextvm deploy

Deploy built modules to a target FXServer's `resources/` directory.

## Synopsis

```bash
nextvm deploy --target <path> [--clean] [--only <module>]
```

## Options

| Option | Default | Description |
|---|---|---|
| `--target <path>` | — (required) | Target FXServer `resources/` directory |
| `--clean` | off | Remove existing module folders before copying |
| `--only <module>` | — | Deploy only the named module (repeatable) |

## What it does

1. Loads `nextvm.config.ts`
2. Verifies every selected module has a fresh `dist/` + `fxmanifest.lua`
   (fails fast if you forgot to run `nextvm build`)
3. For each module, copies `modules/<name>/` → `<target>/<name>/`
   excluding `src/`, `node_modules/`, and `*.map` files
4. Prints a per-module summary with file count + total size

## Examples

### Deploy all modules

```bash
nextvm deploy --target /srv/fxserver/resources
```

### Deploy a single module

```bash
nextvm deploy --target /srv/fxserver/resources --only banking
```

### Clean deploy (wipes old folders first)

```bash
nextvm deploy --target /srv/fxserver/resources --clean
```

## Example output

```
ℹ Deploying 3 module(s) to /srv/fxserver/resources

  ✓ @nextvm/banking    24 files, 184 KB
  ✓ @nextvm/jobs       18 files, 142 KB
  ✓ @nextvm/housing    21 files, 168 KB

✓ Deployed 3 module(s) in 312ms.

→ Don't forget to `ensure` each module in server.cfg.
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All modules deployed successfully |
| 1 | Build artifacts missing, target invalid, or copy failed |

## See also

- [`nextvm build`](/cli/build) — must run first
- [Installation guide](/guide/installation)
