# Migrating from QBCore

NextVM ships a complete migration toolkit for servers running QBCore.
The migration is **non-destructive** against your existing database
— the tool only reads — and produces a structured report.

## What gets migrated

| QBCore | NextVM |
|---|---|
| `players` rows | `nextv_users` + `nextv_characters` |
| `players.license` | `nextv_users.license` |
| `players.citizenid` | falls back to `nextv_users.license` if no license |
| `players.money.cash` | `nextv_characters.cash` |
| `players.money.bank` | `nextv_characters.bank` |
| `players.charinfo.firstname/lastname` | `nextv_characters.firstName/lastName` |
| `players.charinfo.birthdate` | `nextv_characters.dateOfBirth` |
| `players.charinfo.gender` | `nextv_characters.gender` |
| `players.position` | `nextv_characters.position` (JSON) |
| `players.job.name` + `job.grade.level` | `nextv_characters.job` + metadata |
| `players.inventory` | `nextv_characters.metadata.inventory` (JSON) |

QBCore's `crypto` money type is dropped during migration — NextVM does
not have a built-in third currency. If you need it, you can preserve
it in `metadata` by extending `QbCoreMigrationSource`.

## Prerequisites

1. **Back up your QBCore database.** `mysqldump qbcore > qb-backup.sql`.
2. Install NextVM in a fresh project (`nextvm create my-server`).
3. Configure the NextVM database in `nextvm.config.ts`.
4. Run `nextvm db:migrate` to create the empty `nextv_*` tables.

## Dry run

```bash
nextvm migrate:from qbcore \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db qbcore \
  --dry-run
```

You'll get a structured report showing how many rows would be inserted,
how many would be skipped, and which warnings each row produced.

## Real run

```bash
nextvm migrate:from qbcore \
  --source-host localhost \
  --source-user root \
  --source-password yourpass \
  --source-db qbcore
```

## QBCore-specific notes

### Multi-character support
QBCore stores **one row per character** in the `players` table (a
single license can have multiple `citizenid`s). The migration creates
**one `nextv_users` row per unique license**, then adds each character
under that user. So a QBCore player with three characters becomes one
NextVM user with three characters — preserving the multi-character
experience.

### CitizenId fallback
If a `players` row has no `license` column (older QBCore versions or
custom forks), the migration falls back to `qb:<citizenid>` as the
NextVM license. This is reversible — if you re-run the migration after
backfilling licenses, the CitizenId-based identifiers can be dropped
manually.

### Inventory format
QBCore inventory is `[{ slot, name, amount, ... }]`. The migration
preserves the slot information in the metadata blob — the NextVM
inventory module reads it on first character load.

### Job grade
QBCore stores grade as a nested object: `job.grade.level`. The migration
maps this to `nextv_characters.metadata.jobGrade`. The jobs module
picks it up via the character lifecycle.

## Schema mapping details

```sql
SELECT citizenid, license, money, charinfo, job, position, inventory
FROM players
```

The adapter parses every JSON column with a permissive parser — if a
column is missing or malformed, the row is reported as a warning and
skipped (default).

## Programmatic API

```typescript
import { Database, MySqlAdapter } from '@nextvm/db'
import {
  QbCoreMigrationSource,
  DbMigrationTarget,
  runMigration,
  formatReport,
} from '@nextvm/migration'

const sourceDb = new Database(new MySqlAdapter({
  host: 'localhost', port: 3306, user: 'root',
  password: 'pw', database: 'qbcore',
}))
const targetDb = new Database(new MySqlAdapter({
  host: 'localhost', port: 3306, user: 'root',
  password: 'pw', database: 'nextvm',
}))

const report = await runMigration(
  new QbCoreMigrationSource(sourceDb),
  new DbMigrationTarget(targetDb),
)

console.log(formatReport(report))
```

## See also

- [Migration from ESX](/guide/migration-from-esx)
- [`@nextvm/migration`](/packages/migration) package reference
- [`@nextvm/compat`](/packages/compat) for QBCore export coexistence
- [`nextvm migrate:from`](/cli/migrate-from) CLI reference
