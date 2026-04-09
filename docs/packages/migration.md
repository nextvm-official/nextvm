# @nextvm/migration

ESX/QBCore database migration toolkit. Reads legacy player data,
writes it into the NextVM `nextv_users` + `nextv_characters` tables,
emits a typed report. Non-destructive against the source.

## Install

```bash
pnpm add @nextvm/migration
```

## runMigration

```typescript
import {
  Database,
  MySqlAdapter,
} from '@nextvm/db'
import {
  EsxMigrationSource,
  DbMigrationTarget,
  runMigration,
  formatReport,
} from '@nextvm/migration'

const sourceDb = new Database(new MySqlAdapter({ /* ESX DB */ }))
const targetDb = new Database(new MySqlAdapter({ /* NextVM DB */ }))

const report = await runMigration(
  new EsxMigrationSource(sourceDb),
  new DbMigrationTarget(targetDb),
  {
    dryRun: false,
    onProgress: (cur, total) => console.log(`${cur}/${total}`),
  },
)

console.log(formatReport(report))
await sourceDb.close()
await targetDb.close()
```

## Sources

| Class | Reads from |
|---|---|
| `EsxMigrationSource` | Standard ESX 1.x `users` + `owned_vehicles` |
| `QbCoreMigrationSource` | Standard QBCore `players` |
| `InMemoryMigrationSource` | Test helper — pass an array of `LegacyPlayer` rows |

Each source implements the `MigrationSource` interface:

```typescript
interface MigrationSource {
  readonly framework: 'esx' | 'qbcore' | 'memory'
  listPlayers(): AsyncIterable<LegacyPlayer>
  count(): Promise<number>
  close?(): Promise<void>
}
```

## Targets

| Class | Writes to |
|---|---|
| `DbMigrationTarget` | Real NextVM database via `@nextvm/db` |
| `InMemoryMigrationTarget` | Test helper — records inserts in memory |

```typescript
interface MigrationTarget {
  insertUser(input): Promise<{ id: number }>
  insertCharacter(input): Promise<{ id: number }>
  close?(): Promise<void>
}
```

## LegacyPlayer

The normalized row shape:

```typescript
interface LegacyPlayer {
  identifier: string                    // license, citizenid, ...
  discord: string | null
  steam: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string | null
  cash: number
  bank: number
  job: string
  jobGrade: number
  position: { x: number; y: number; z: number }
  inventory: LegacyInventoryItem[]
  vehicles: LegacyVehicle[]
}
```

## MigrationReport

```typescript
interface MigrationReport {
  framework: 'esx' | 'qbcore' | 'memory'
  startedAt: Date
  finishedAt: Date
  dryRun: boolean
  totalRowsRead: number
  usersInserted: number
  charactersInserted: number
  skipped: number
  warnings: MigrationWarning[]
  errors: MigrationError[]
}
```

## Validation + skipMalformed

Each row goes through `validatePlayer()` before writes. Common
warnings:

- `missing identifier`
- `missing firstName` / `missing lastName`
- `cash is not a number`
- `bank is not a number`

By default malformed rows are **skipped** with a warning. Pass
`skipMalformed: false` to make them errors instead.

## License normalization

The runner normalizes legacy identifiers into a canonical
`license:...` format:

- ESX `license:abc...` → `license:abc...` (unchanged)
- ESX `license:abc... discord:123` → `license:abc...` (extracts the license part)
- QBCore raw citizenid `XYZ123` → `qb:XYZ123` (fallback)

This guarantees that `nextv_users.license` is always queryable with a
predictable format.

## Tests

`packages/migration/__tests__/` contains 8 tests covering happy-path
migration, license normalization, malformed-row skipping, dry-run,
inventory + metadata JSON capture, progress callbacks, formatReport
output, and error capture with the offending identifier.

## See also

- [Migration from ESX](/guide/migration-from-esx)
- [Migration from QBCore](/guide/migration-from-qbcore)
- [`nextvm migrate:from`](/cli/migrate-from)
- [Concept Chapter 16.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
