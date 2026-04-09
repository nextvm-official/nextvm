# nextvm dev

Dev mode with file watching and incremental rebuilds.

## Synopsis

```bash
nextvm dev
```

## What it does

1. Loads the project
2. Runs an initial full build (so the dev session starts from a
   known state)
3. Starts a chokidar watcher on each module's `src/`
4. On change → debounces, rebuilds the affected module with
   `skipLocales: true` for speed
5. Fires the `onModuleRebuilt` callback so the runtime layer can
   `ensure`-restart the resource (Phase 4)

The session stays alive until you hit Ctrl+C or send SIGTERM.

## Example output

```
NextVM dev — watching 3 module(s)

Building 3 module(s)
  ✓ @nextvm/banking (61ms)
  ✓ @nextvm/jobs (12ms)
  ✓ @nextvm/housing (10ms)
✓ Built 3 module(s) in 83ms

Press Ctrl+C to stop.

[10:30:15] rebuilding @nextvm/banking...
  ✓ @nextvm/banking rebuilt
```

## What it doesn't do (yet)

- **NUI HMR** lands in Phase 4 with the full runtime layer
- **State preservation across restarts** lands in Phase 4 — modules
  can already opt in via `serialize()` / `deserialize()` on their
  state stores, but the dev orchestrator doesn't automatically
  invoke them yet
- **ensure-restart bridge** to a running FXServer — for now, you
  manually `ensure <name>` after a rebuild, or wire up your own
  `onModuleRebuilt` callback

These deferrals are documented in
[`packages/build/src/dev-orchestrator.ts`](https://github.com/nextvm-official/nextvm/blob/main/packages/build/src/dev-orchestrator.ts).

## See also

- [`nextvm build`](/cli/build) — one-shot production build
- [`@nextvm/build`](/packages/build) package reference
- [Concept Chapter 15.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
