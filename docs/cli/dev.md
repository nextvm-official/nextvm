# nextvm dev

Dev mode with file watching, incremental rebuilds, and an optional
local FXServer subprocess.

## Synopsis

```bash
nextvm dev              # rebuild watcher only
nextvm dev --serve      # rebuild watcher + local FXServer subprocess
```

## Flags

| Flag | Description |
|---|---|
| `--serve` | Spawn a local FXServer subprocess against your built modules. Requires a `fxserver` block in `nextvm.config.ts`. See [Local FXServer](/guide/local-fxserver). |

## What it does

1. Loads the project
2. Runs an initial full build (so the dev session starts from a
   known state)
3. Starts a chokidar watcher on each module's `src/`
4. On change → debounces, rebuilds the affected module with
   `skipLocales: true` for speed
5. Writes `.nextvm/dev-trigger.json` so the runtime-server's dev
   bridge can `ensure`-restart the resource inside FXServer
6. **With `--serve`**: also spawns FXServer, links modules into
   `resources/[nextvm]/`, generates `server.cfg.nextvm`, and streams
   the FXServer logs into your terminal with a cyan `[fx]` prefix

The session stays alive until you hit Ctrl+C. Cleanup tears down the
watcher, the FXServer process tree, and the symlinks.

## Example output (`--serve`)

```
▲ NextVM v0.0.x
dev — watching modules for changes

  › Initial build of 3 module(s)…
  ✓ Initial build completed in 64ms

  [runner] Resolved FXServer binary: C:\fivem\server\FXServer.exe
  [runner] Linked 3 module(s) (symlinks)
  [runner] Wrote C:\fivem\server-data\server.cfg.nextvm
  [runner] FXServer started (PID 12345)
  ✓ FXServer running (PID 12345)
  ✓ Watching 3 modules for changes
  Press Ctrl+C to stop.

  [fx] [   resources] Started resource shop
  ...

22:42:10 ● Rebuilding shop…
22:42:10 ✓ shop rebuilt in 9ms
  [runner] ensure shop (via dev-trigger)
  [fx] [resources] Stopping resource shop
  [fx] [resources] Started resource shop
```

## See also

- [`nextvm serve`](/cli/serve) — one-shot build + FXServer, no watcher
- [`nextvm build`](/cli/build) — one-shot production build
- [Local FXServer](/guide/local-fxserver) — full setup walkthrough
- [`@nextvm/build`](/packages/build) package reference
