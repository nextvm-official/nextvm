# @nextvm/runtime-server

## 0.0.2

### Patch Changes

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
