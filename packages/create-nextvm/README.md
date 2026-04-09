# create-nextvm

Bootstrap a new [NextVM](https://github.com/nextvm-official/nextvm) project
with a single command. No global installation required.

```bash
# pnpm (recommended)
pnpm create nextvm@latest my-server

# npm
npm create nextvm@latest my-server

# yarn
yarn create nextvm my-server
```

After scaffold:

```bash
cd my-server
pnpm install
pnpm dev
```

That's it. Your project is ready with the full NextVM toolchain wired
in via local devDependencies — no global state, no version drift.

## What this creates

- `package.json` with pinned `@nextvm/cli` + framework deps
- `nextvm.config.ts` — project surface
- `tsconfig.json` — strict TypeScript
- `modules/` — empty directory ready for your first `pnpm add nextvm` module
- `.gitignore` — sensible defaults

## What this does NOT do

This package is intentionally tiny and only handles the scaffold step.
It does not run `pnpm install` or `nextvm dev` for you — keeping the
flow predictable and letting you choose your own package manager.

## See also

- [NextVM Documentation](https://docs.nextvm.dev)
- [`@nextvm/cli`](https://www.npmjs.com/package/@nextvm/cli) — the
  CLI that powers `pnpm dev`, `pnpm build`, etc. inside the scaffolded
  project
