# nextvm migrate:from

Migrate an ESX or QBCore database into the NextVM schema.

## Synopsis

```bash
nextvm migrate:from <framework> \
  --source-host <host> \
  --source-port <port> \
  --source-user <user> \
  --source-password <password> \
  --source-db <database> \
  [--dry-run]
```

## Arguments

| Arg | Required | Values |
|---|---|---|
| `<framework>` | yes | `esx` or `qbcore` |

## Options

| Option | Default | Description |
|---|---|---|
| `--source-host` | `localhost` | Source DB host |
| `--source-port` | `3306` | Source DB port |
| `--source-user` | `root` | Source DB user |
| `--source-password` | `''` | Source DB password |
| `--source-db` | — (required) | Source DB database name |
| `--dry-run` | off | Read + report without writing |

## What it does

1. Loads `nextvm.config.ts` for the target connection
2. Connects to the source ESX or QBCore database (read-only)
3. Streams every player row through the appropriate adapter
4. Maps identifiers, money, inventory, position to the NextVM schema
5. Inserts one `nextv_users` + one `nextv_characters` row per source
6. Skips malformed rows with a warning (default)
7. Prints a final report with totals + warnings + errors

## Examples

### Dry run (recommended first)

```bash
nextvm migrate:from esx \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db esx_db \
  --dry-run
```

### Real run

```bash
nextvm migrate:from qbcore \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db qbcore
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Migration finished without errors |
| 1 | Migration finished with at least one error, or argument validation failed |

## Sample output

```
Migrating from esx
ℹ Loading project...
→ Running migration...
→ Migrated 100/4523
→ Migrated 200/4523
...
→ Migrated 4523/4523

Migration from esx
  Started:    2026-04-08T10:30:00Z
  Finished:   2026-04-08T10:30:14Z
  Duration:   14000ms
  Rows read:  4523
  Users:      4515
  Characters: 4515
  Skipped:    8
  Warnings:   8
  Errors:     0

Warnings:
  - [license:abc...] missing firstName
  - [license:def...] cash is not a number
  ...

✓ Migration complete.
```

## See also

- [Migration from ESX guide](/guide/migration-from-esx)
- [Migration from QBCore guide](/guide/migration-from-qbcore)
- [`@nextvm/migration`](/packages/migration) package reference
