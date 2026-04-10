# @nextvm/build

## 0.1.2

### Patch Changes

- fix(build): client bundles use IIFE format (not CJS)

  FiveM's client-side V8 isolate has no CommonJS module system — there
  is no `module`, `exports`, or `require` global. The build orchestrator
  was using CJS for both server and client, causing
  `ReferenceError: module is not defined` on every client script load.

  Server bundles stay CJS (FXServer's server-side has Node-like CJS).
  Client bundles now use IIFE (self-executing function wrapper that
  doesn't need any module system globals).

## 0.1.1

### Patch Changes

- fix(fxserver-runner,build): config file path + .env loading

  Two bugs found during end-to-end scaffold test:

  1. FXServer couldn't find server.cfg.nextvm because the runner passed
     the full path to +exec, but FXServer resolves +exec relative to
     its cwd. Now passes just the filename 'server.cfg.nextvm'.

  2. process.env.CFX_LICENSE_KEY was always empty because nothing loaded
     the .env file. Added .env auto-loading in loadProject() using
     Node 22's process.loadEnvFile() with a manual KEY=VALUE parser
     fallback. Only sets vars that aren't already in the environment.

## 0.1.0

### Minor Changes

- 66fd23b: fix(build,fxserver,runtime-server): end-to-end hot-reload across split layouts

  The first end-to-end smoke test against a real FXServer surfaced four
  distinct issues that all blocked live module reload. All fixed:

  1. **CJS bundle format**: tsup was emitting ESM but FXServer's V8
     isolate runs scripts as CommonJS — top-level `import` statements
     throw "Cannot use import statement outside a module". Switched the
     build orchestrator to `format: 'cjs'`.

  2. **noExternal for `@nextvm/*`**: tsup auto-marks every entry in a
     module's `dependencies` as external. Inside FXServer there is no
     node_modules tree, so `require('@nextvm/runtime-server')` fails at
     runtime. Added `noExternal: [/^@nextvm\//]` to inline every NextVM
     package into each resource bundle. The external list now only
     contains things FXServer provides natively (`@citizenfx/*`) and
     native modules that genuinely cannot be bundled (`mysql2`, etc.).

  3. **Dev-bridge path resolution**: the runtime-server's dev bridge
     watched `.nextvm/dev-trigger.json` relative to FXServer's cwd. In
     the standard split server/server-data layout the FXServer cwd
     (server-data/) is not the project root, so the bridge could never
     see the trigger file the runner wrote. The runner now emits
     `set nextvm_dev_trigger "<absolute path>"` in server.cfg.nextvm
     and the bridge resolves the path via `GetConvar` before falling
     back to the relative default.

  4. **Resource ACL for `ensure`**: FXServer's `ensure` command (which
     internally invokes `stop` + `start`) is ACL-restricted; resource
     principals cannot run it by default. The runner now emits
     `add_ace resource.<module> command allow` for each linked module
     when the dev bridge is active. Dev-only — gated on devTriggerPath
     being set.

  End-to-end smoke test verified: edit module file → 9ms rebuild →
  runner.ensure() writes trigger → bridge GetConvar locates it → bridge
  fires ExecuteCommand('ensure smoke') → FXServer stops + restarts the
  resource → new bundle logs the updated message.

- b129b2f: feat(fxserver): local FXServer subprocess integration

  - New `@nextvm/fxserver-runner` package: spawns and manages a local
    FXServer process for development. Generates `server.cfg.nextvm`,
    symlinks (or junctions on Windows) modules into `resources/[nextvm]/`,
    streams logs, handles graceful shutdown + cleanup.
  - New `nextvm serve` command: builds modules then boots FXServer
    against them. Supports `--no-build` to skip the build step.
  - New `nextvm dev --serve` flag: runs the dev watcher AND a local
    FXServer side-by-side. Each successful module rebuild triggers
    `runner.ensure(name)` for live reload inside FXServer.
  - New `fxserver` block in `nextvm.config.ts` schema (path,
    licenseKey, gameBuild, endpoint, additionalResources, convars).

### Patch Changes

- b108493: Fix `Cannot find module 'typescript'` when installing `@nextvm/cli`
  via `pnpm dlx` or as a global. `typescript` was only declared in
  `devDependencies` of `@nextvm/build`, but `tsup` (which the build
  orchestrator calls at runtime) requires it via `require('typescript')`
  for DTS generation. Moved `typescript` to `dependencies` so it's
  always installed alongside the build pipeline.
- b41cd0b: fix(fxserver): support split server/server-data layout + Windows tree-kill

  Two issues found during the first end-to-end smoke test against a real
  FiveM artifact:

  1. **Split layout**: cfx-server-data installations have `FXServer.exe`
     in `server/` and `resources/` in `server-data/cfx-server-data/`.
     The runner previously assumed both lived in one folder. Added an
     optional `fxserver.dataPath` config field; the runner uses it for
     `resources/`, the generated `server.cfg.nextvm`, and the spawn cwd.
     Defaults to `path` for the all-in-one artifact layout.

  2. **Windows tree-kill**: FXServer.exe spawns a child server process
     that doesn't respond to WM_CLOSE. Plain `child.kill()` only
     terminated the launcher and orphaned the actual server. The default
     IO now uses `taskkill /T /F` on Windows to walk the process tree.

- ee609c0: Polish the CLI experience across the board.

  **`create-nextvm` interactive wizard.** Run `pnpm create nextvm@latest`
  without any arguments and get a guided setup powered by `@clack/prompts`:

  - Project name with live validation (existing dirs caught immediately)
  - Template picker with hint text (Starter recommended, Blank for advanced)
  - Confirmation step before scaffolding
  - Cancellable at any step (Ctrl+C cleanly aborts)

  The non-interactive form still works:

  ```bash
  pnpm create nextvm@latest my-server                       # blank
  pnpm create nextvm@latest my-server --template starter    # working
  pnpm create nextvm@latest my-server -y                    # CI / no prompts
  ```

  **`@nextvm/cli` logger redesign.** Consistent symbol set (`▲` `›` `✓`
  `✗` `⚠` `ℹ`), brand banner with version, indented output column, new
  `cliLog.banner()` and `cliLog.br()` helpers. Every command now uses
  the same vocabulary instead of mixing styles.

  **`nextvm dev` empty-state hint.** When `pnpm dev` runs in a project
  with zero modules, instead of silently watching nothing, it now shows:

  ```
  ▲ NextVM v0.0.2
    dev — watching modules for changes

    ⚠ No modules found in this project yet.

    Add your first module:
      › pnpm add:module shop --full

    Or scaffold a starter project with everything pre-wired:
      › pnpm create nextvm@latest my-server --template starter

    Watching modules/ — drop a module folder in and it will be picked
    up automatically.
  ```

  **`@nextvm/build` dev-orchestrator output polish.** The dev watcher
  now prints timestamped per-module rebuild lines with elapsed time:

  ```
    09:42:11 ● Rebuilding banking…
    09:42:11 ✓ banking rebuilt in 312ms
  ```

  instead of the previous unstyled `[time] rebuilding name` format.
  Initial-build line shows the module count and total time. The legacy
  "NextVM dev — watching N module(s)" header was removed because the
  CLI command now owns the brand banner.

  No breaking changes — all command surfaces and APIs are backward
  compatible.
