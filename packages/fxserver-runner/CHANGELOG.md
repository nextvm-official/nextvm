# @nextvm/fxserver-runner

## 0.1.1

### Patch Changes

- fix(fxserver-runner): resolve relative paths before spawn

  child_process.spawn can't find binaries via relative paths like
  `.fxserver/artifacts/FXServer.exe`. The default IO layer now calls
  `path.resolve()` on the binary path and cwd before spawning.
  The fix lives in default-io.ts (real IO only) so mock-based tests
  continue to work with their synthetic paths.

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

- f43e42c: feat(fxserver): lockfile to prevent concurrent runners on the same install

  The runner now writes `<dataPath>/.nextvm.lock` containing its PID on
  start and removes it on stop. A second `nextvm dev --serve` against
  the same FXServer install fails fast with a clear message pointing
  at the lockfile and the holder PID. Stale locks (recorded PID is no
  longer alive) are silently reclaimed.

  Resolves Open Question #4 from `.ai/scratchpad/fxserver-integration.md`.

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
