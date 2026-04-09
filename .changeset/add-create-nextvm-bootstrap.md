---
"create-nextvm": minor
"@nextvm/cli": patch
---

Add the `create-nextvm` bootstrap package so users can scaffold a new
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
