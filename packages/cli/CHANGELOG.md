# @nextvm/cli

## 0.0.2

### Patch Changes

- 5b78e94: Fix `Cannot find module 'typescript'` when installing `@nextvm/cli`
  via `pnpm dlx` or as a global. `typescript` was only declared in
  `devDependencies` of `@nextvm/build`, but `tsup` (which the build
  orchestrator calls at runtime) requires it via `require('typescript')`
  for DTS generation. Moved `typescript` to `dependencies` so it's
  always installed alongside the build pipeline.
- Updated dependencies [5b78e94]
  - @nextvm/build@0.0.2
