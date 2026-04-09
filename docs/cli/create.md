# nextvm create

Scaffold a new NextVM server project.

## Synopsis

```bash
nextvm create <name> [--dir <path>]
```

## Arguments

| Arg | Required | Description |
|---|---|---|
| `<name>` | yes | Project name (also used as the directory name unless `--dir` is set) |

## Options

| Option | Default | Description |
|---|---|---|
| `--dir <path>` | `<name>` | Target directory |

## What it does

Creates a fresh NextVM project with the standard layout:

```
my-server/
├── nextvm.config.ts        # Server name, DB connection, modules to load
├── package.json            # Lists @nextvm/* devDeps + scripts
├── tsconfig.json
├── modules/                # Empty — your modules live here
└── .gitignore
```

The generated `package.json` includes scripts for `dev`, `build`,
and `validate` so you can immediately run them with `pnpm <script>`.

## Example

```bash
nextvm create my-rp-server
cd my-rp-server
pnpm install
nextvm add banking --full
```

## Errors

- Exits 1 if the target directory already exists.

## See also

- [Installation guide](/guide/installation)
- [`nextvm add`](/cli/add)
