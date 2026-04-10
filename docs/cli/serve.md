# nextvm serve

One-shot: build every module then spawn a local FXServer subprocess
against the result. No file watching — restart the command after a
code change.

For the rebuild-on-change loop, use [`nextvm dev --serve`](/cli/dev)
instead.

## Synopsis

```bash
nextvm serve              # build then spawn FXServer
nextvm serve --no-build   # skip the build step (use existing dist/)
```

## Flags

| Flag | Description |
|---|---|
| `--no-build` | Skip the initial build and use whatever's already in each module's `dist/`. Handy when you've just built manually and only want to boot the server. |

## Requires

A `fxserver` block in `nextvm.config.ts`. The command errors out
with a hint if it's missing. See [Local FXServer](/guide/local-fxserver)
for the full setup.

## What it does

1. Loads the project
2. Builds every module (unless `--no-build`)
3. Resolves the FXServer binary
4. Links modules into `<dataPath>/resources/[nextvm]/`
5. Generates `server.cfg.nextvm` from `nextvm.config.ts`
6. Spawns FXServer and streams logs with a cyan `[fx]` prefix
7. On Ctrl+C: kills the FXServer process tree and removes the
   `[nextvm]/` symlinks

## See also

- [`nextvm dev --serve`](/cli/dev) — same setup but with file watching
- [Local FXServer](/guide/local-fxserver) — one-time setup walkthrough
