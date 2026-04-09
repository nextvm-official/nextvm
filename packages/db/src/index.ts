/**
 * @nextvm/db — NextVM Database Layer
 *
 * Concept v2.3, Chapter 12:
 *   - Custom typed query builder (lighter than ORM)
 *   - MySQL primary, PostgreSQL adapter optional
 *   - Migration CLI integration: db:generate / db:migrate / db:rollback / db:seed
 *
 * Usage:
 *   import { defineTable, column, Database, MySqlAdapter } from '@nextvm/db'
 *
 *   const players = defineTable('nextv_characters', {
 *     id: column.int().primaryKey().autoIncrement(),
 *     firstName: column.string(50),
 *     cash: column.int().default(0),
 *   })
 *
 *   const db = new Database(new MySqlAdapter({ host, user, password, database }))
 *   const player = await db.query(players).where({ id: charId }).first()
 */

// Schema
export { defineTable } from './define-table'
export type { Table, TableSchema, InferRow } from './define-table'
export { column, ColumnBuilder } from './column'
export type { ColumnType, ColumnDefinition } from './column'
export { SchemaBuilder } from './schema-builder'

// Database facade
export { Database } from './database'

// Adapter interface
export type { DatabaseAdapter, PreparedQuery } from './adapter'

// MySQL adapter
export { MySqlAdapter } from './adapters/mysql'

// Query builders (re-exported for advanced usage)
export {
	SelectBuilder,
	InsertBuilder,
	UpdateBuilder,
	DeleteBuilder,
} from './query-builder'

// Migrations
export { defineMigration } from './migrations/define-migration'
export { MigrationRunner } from './migrations/runner'
export type { Migration, MigrationRecord } from './migrations/types'

// Character Repository (implements @nextvm/core port)
export { DbCharacterRepository } from './character-repository/db-character-repository'
export { initialCharacterMigration } from './character-repository/migration'
export { usersTable, charactersTable } from './character-repository/schema'
