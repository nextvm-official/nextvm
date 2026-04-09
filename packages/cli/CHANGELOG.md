# @nextvm/cli

## 0.0.2

### Patch Changes

- fd443ad: Add the `create-nextvm` bootstrap package so users can scaffold a new
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

- fd443ad: Fix `Cannot find module 'typescript'` when installing `@nextvm/cli`
  via `pnpm dlx` or as a global. `typescript` was only declared in
  `devDependencies` of `@nextvm/build`, but `tsup` (which the build
  orchestrator calls at runtime) requires it via `require('typescript')`
  for DTS generation. Moved `typescript` to `dependencies` so it's
  always installed alongside the build pipeline.
- Updated dependencies [fd443ad]
  - @nextvm/build@0.0.2
