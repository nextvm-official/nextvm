# @nextvm/cli

## 0.0.2

### Patch Changes

- 4214766: Add the `create-nextvm` bootstrap package so users can scaffold a new
  NextVM project with a single command and zero global installs:

  ```bash
  pnpm create nextvm@latest my-server
  npm create nextvm@latest my-server
  yarn create nextvm my-server
  ```

  The package follows the standard `create-*` convention used by Next.js,
  Vite, Astro, etc. — `pnpm create <name>` automatically resolves to
  `create-<name>` on npm. After scaffolding, the project has the full
  NextVM toolchain wired in via local devDependencies, so all subsequent
  commands run via `pnpm dev` / `pnpm build` / `pnpm validate` without
  any global tools.

  Also updates the `nextvm create` command in `@nextvm/cli` to generate
  the same project shape (engines pinned to Node 22, scripts include
  `add:module`, runtime packages added to `dependencies`).

- 4214766: Fix `Cannot find module 'typescript'` when installing `@nextvm/cli`
  via `pnpm dlx` or as a global. `typescript` was only declared in
  `devDependencies` of `@nextvm/build`, but `tsup` (which the build
  orchestrator calls at runtime) requires it via `require('typescript')`
  for DTS generation. Moved `typescript` to `dependencies` so it's
  always installed alongside the build pipeline.
- 9842a8b: Polish the CLI experience across the board.

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

- Updated dependencies [4214766]
- Updated dependencies [9842a8b]
  - @nextvm/build@0.0.2
