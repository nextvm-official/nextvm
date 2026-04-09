# @nextvm/db

NextVM's database layer: a typed query builder, schema definition API,
migration runner, and MySQL adapter. Built on `mysql2/promise` with
PostgreSQL on the roadmap.

## Install

```bash
pnpm add @nextvm/db mysql2
```

## Defining tables

```typescript
import { defineTable, column } from '@nextvm/db'

export const users = defineTable('nextv_users', {
  id: column.int().primaryKey().autoIncrement(),
  license: column.string(50).unique(),
  discord: column.string(30).nullable(),
  steam: column.string(30).nullable(),
  lastSeen: column.timestamp().defaultNow(),
  banned: column.boolean().default(false),
})
```

The table type is inferred — `InferRow<typeof users>` gives you
`{ id: number, license: string, discord: string | null, ... }`.

## Column builders

| Builder | SQL | TS type |
|---|---|---|
| `column.int()` | `INT` | `number` |
| `column.bigint()` | `BIGINT` | `number` |
| `column.float()` | `FLOAT` | `number` |
| `column.string(length)` | `VARCHAR(n)` | `string` |
| `column.text()` | `TEXT` | `string` |
| `column.boolean()` | `TINYINT(1)` | `boolean` |
| `column.json<T>()` | `JSON` | `T` (default `Record<string, unknown>`) |
| `column.timestamp()` | `TIMESTAMP` | `Date` |
| `column.datetime()` | `DATETIME` | `Date` |

Modifiers (chainable):

- `.primaryKey()`
- `.autoIncrement()`
- `.nullable()` — adds `| null` to the inferred type
- `.unique()`
- `.default(value)`
- `.defaultNow()` — emits `CURRENT_TIMESTAMP`
- `.references('table.column')` — foreign key

## Database facade

```typescript
import { Database, MySqlAdapter } from '@nextvm/db'

const db = new Database(new MySqlAdapter({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'nextvm',
}))
```

## Query builder

```typescript
// SELECT
const player = await db.query(users)
  .where({ id: charId })
  .select('id', 'license')
  .first()

const banned = await db.query(users)
  .where('banned', '=', true)
  .orderByColumn('lastSeen', 'DESC')
  .limit(50)
  .all()

// INSERT
const id = await db.insert(users).one({
  license: 'license:abc',
  discord: 'discord:123',
})

// UPDATE
const affected = await db.update(users)
  .where({ id: 1 })
  .set({ lastSeen: new Date() })

// DELETE
const removed = await db.delete(users)
  .where({ id: 99 })
  .execute()

// Transactions
await db.transaction(async (tx) => {
  await tx.insert(users).one({ ... })
  await tx.insert(characters).one({ ... })
})

// Raw SQL escape hatch
const rows = await db.raw<{ count: number }>('SELECT COUNT(*) AS count FROM users')
```

## Migrations

```typescript
import { defineMigration, MigrationRunner } from '@nextvm/db'

const initial = defineMigration({
  name: '0001_initial',
  async up(db) {
    await db.raw(`CREATE TABLE ...`)
  },
  async down(db) {
    await db.raw(`DROP TABLE ...`)
  },
})

const runner = new MigrationRunner(db)
runner.add(initial)

const applied = await runner.migrate()         // run pending
await runner.rollback(1)                       // roll back last
const pending = await runner.getPending()
```

The framework's `initialCharacterMigration` is registered automatically
when you run `nextvm db:migrate` from the CLI.

## Character repository

`@nextvm/db` ships `DbCharacterRepository` as the production
implementation of the `CharacterRepository` port from `@nextvm/core`:

```typescript
import { DbCharacterRepository } from '@nextvm/db'
import { CharacterService } from '@nextvm/core'

const repo = new DbCharacterRepository(db)
const characters = new CharacterService({ repository: repo })
```

For tests, use `InMemoryCharacterRepository` from
[`@nextvm/test-utils`](/packages/test-utils).

## Schema builder

For tooling that needs to emit DDL (migrations, dumps, the
`nextvm db:generate` command):

```typescript
import { SchemaBuilder } from '@nextvm/db'

const builder = new SchemaBuilder(db.getAdapter())
const sql = builder.createTable(users)
// → 'CREATE TABLE IF NOT EXISTS `nextv_users` (...)'
```

## Tests

`packages/db/__tests__/` contains 21 tests covering the query builder,
schema builder, and migration runner. Tests use a small in-memory
adapter so no real MySQL is required.

## See also

- [Concept Chapter 12](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
- [Character System](/concept/character-system)
- [`nextvm db` CLI](/cli/db)
