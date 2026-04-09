# Migrating from ESX

NextVM ships a complete migration toolkit for servers running
ESX 1.x. The migration is **non-destructive** against your existing
database — the tool only reads — and produces a structured report
with warnings and errors.

## What gets migrated

| ESX | NextVM |
|---|---|
| `users` rows | `nextv_users` + `nextv_characters` (1 character per ESX user) |
| `users.identifier` | `nextv_users.license` (canonicalized to `license:...`) |
| `users.accounts.money` | `nextv_characters.cash` |
| `users.accounts.bank` | `nextv_characters.bank` |
| `users.firstname/lastname` | `nextv_characters.firstName/lastName` |
| `users.dateofbirth/sex` | `nextv_characters.dateOfBirth/gender` |
| `users.position` | `nextv_characters.position` (JSON) |
| `users.job/job_grade` | `nextv_characters.job` + metadata |
| `users.inventory` | `nextv_characters.metadata.inventory` (JSON) |
| `owned_vehicles` | `nextv_characters.metadata.vehicles` (JSON) |

## Prerequisites

Before you run the migration:

1. **Back up your ESX database.** The toolkit doesn't write to the
   source, but back up anyway. `mysqldump esx_db > esx-backup.sql`.
2. Install NextVM in a fresh project (`nextvm create my-server`).
3. Configure the NextVM database in `nextvm.config.ts`. The migration
   will read this for the target connection.
4. Run `nextvm db:migrate` to create the empty `nextv_users` and
   `nextv_characters` tables.

## Dry run

Always start with a dry run. It reads everything and shows you the
report without writing anything to the NextVM database:

```bash
nextvm migrate:from esx \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db esx_db \
  --dry-run
```

Output:

```
Migrating from esx
ℹ Loading project...
→ Dry run — no writes
→ Migrated 100/4523
→ Migrated 200/4523
...
→ Migrated 4523/4523

Migration from esx (dry run)
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
  - [license:abc123] missing firstName
  - [license:def456] cash is not a number
  ...
```

## Real run

Once the dry run looks clean (or you've decided what to do about the
warnings), drop the `--dry-run` flag:

```bash
nextvm migrate:from esx \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db esx_db
```

The toolkit will:

1. Connect to the source ESX database (read-only)
2. Connect to the target NextVM database (configured in `nextvm.config.ts`)
3. Pre-fetch every `owned_vehicles` row indexed by owner (no N+1)
4. Stream `users` rows one by one, mapping each into a `LegacyPlayer`
5. Insert one `nextv_users` row + one `nextv_characters` row per ESX user
6. Skip rows that fail validation (and log them as warnings)
7. Print a final report

## Handling warnings

The default behavior is to **skip malformed rows** with a warning.
The most common warnings are:

| Warning | What it means | What to do |
|---|---|---|
| `missing firstName` | The ESX user has no `firstname` set | Pre-fix the source DB or accept the skip |
| `missing lastName` | Same | Same |
| `cash is not a number` | The `accounts` JSON has unexpected shape | Inspect the row, decide whether to fix or drop |
| `bank is not a number` | Same | Same |

If you want to keep going past errors instead of skipping, set
`skipMalformed: false` and handle them programmatically — but use
the JS API for that, not the CLI:

```typescript
import { runMigration, EsxMigrationSource, DbMigrationTarget } from '@nextvm/migration'

const report = await runMigration(source, target, {
  skipMalformed: false, // raise instead of skipping
  onProgress: (cur, total) => console.log(`${cur}/${total}`),
})
```

## After the migration

1. **Verify row counts.** `SELECT COUNT(*) FROM nextv_users` should
   match your ESX `users` row count minus the skipped ones.
2. **Spot-check a few characters.** Pick a known player, verify their
   cash, bank, and inventory landed correctly.
3. **Install `@nextvm/compat`** to keep your existing `esx_*` Lua
   resources working alongside NextVM modules during the cutover.
   See [Compatibility Layer](/concept/compatibility-layer).
4. **Migrate one resource at a time** to native NextVM modules.
   The compat layer makes this incremental — there is no big-bang
   switch.

## Schema mapping details

The ESX adapter reads these columns from the standard ESX 1.x schema:

```sql
SELECT identifier, accounts, inventory, position,
       firstname, lastname, dateofbirth, sex,
       job, job_grade
FROM users

SELECT owner, plate, vehicle FROM owned_vehicles
```

If your server has heavily customized ESX (extra columns, renamed
columns, JSON shape changes), the default adapter may produce too many
warnings. In that case, copy `EsxMigrationSource` and modify the
column list / JSON shape to match your server. Open a PR upstream if
the modification is broadly useful.

## Programmatic API

For server operators who want to script the migration as part of a
larger pipeline:

```typescript
import { Database, MySqlAdapter } from '@nextvm/db'
import {
  EsxMigrationSource,
  DbMigrationTarget,
  runMigration,
  formatReport,
} from '@nextvm/migration'

const sourceDb = new Database(new MySqlAdapter({
  host: 'localhost', port: 3306, user: 'root',
  password: 'pw', database: 'esx_db',
}))
const targetDb = new Database(new MySqlAdapter({
  host: 'localhost', port: 3306, user: 'root',
  password: 'pw', database: 'nextvm',
}))

const source = new EsxMigrationSource(sourceDb)
const target = new DbMigrationTarget(targetDb)

const report = await runMigration(source, target, {
  dryRun: false,
  onProgress: (cur, total) => console.log(`${cur}/${total}`),
})

console.log(formatReport(report))
await sourceDb.close()
await targetDb.close()
```

## See also

- [Migration from QBCore](/guide/migration-from-qbcore)
- [`@nextvm/migration`](/packages/migration) package reference
- [`@nextvm/compat`](/packages/compat) for the coexistence story
- [`nextvm migrate:from`](/cli/migrate-from) CLI reference
