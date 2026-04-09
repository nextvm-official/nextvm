# nextvm db

Database utilities. Reads the connection from `nextvm.config.ts`.

## Synopsis

```bash
nextvm db migrate
nextvm db rollback [--steps <count>]
nextvm db generate    # stub
nextvm db seed        # stub
```

## db migrate

Applies every pending migration registered with the project's
`MigrationRunner`. The framework's `initialCharacterMigration` is
always registered first, so you get `nextv_users` + `nextv_characters`
on a fresh DB out of the box.

```bash
nextvm db migrate
```

```
db:migrate
→ Applying 1 migration(s)...
✓ applied 0001_create_character_tables
```

If the database is already up to date:

```
db:migrate
✓ Database is up to date.
```

## db rollback

Rolls back the most recent N migrations (default: 1).

```bash
nextvm db rollback
nextvm db rollback --steps 3
```

```
db:rollback (1 step)
✓ rolled back 0001_create_character_tables
```

## db generate (stubbed)

Diff-based migration generator. Currently prints:

```
⚠ 'nextvm db:generate' is not yet implemented.
→ Schema diff requires a per-project module-state walker. Lands later in Phase 2.
```

Track progress in
[Phase 2 Block I+](https://github.com/nextvm-official/nextvm/tree/main/docs).

## db seed (stubbed)

Per-project seed runner. Currently prints:

```
⚠ 'nextvm db:seed' is not yet implemented.
→ Seed runner needs a per-project seed registry. Lands together with the project module bootstrap.
```

## Authentication

The connection details (host, port, user, password, database) come
from your `nextvm.config.ts`:

```typescript
export default {
  database: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: 'nextvm',
  },
}
```

Use environment variables for the password — never commit a real
password to your repo.

## See also

- [`@nextvm/db`](/packages/db) package reference
- [Character System](/concept/character-system)
- [Concept Chapter 12](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
