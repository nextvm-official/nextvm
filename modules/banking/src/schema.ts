import { column, defineMigration, defineTable, SchemaBuilder } from '@nextvm/db'

/**
 * Banking transactions audit trail.
 *
 * Concept v2.3, Chapter 9.3 conventions: nextv_ prefix for framework
 * tables, but module-owned tables use the `nextv_<module>_` namespace.
 */
export const transactionsTable = defineTable('nextv_banking_transactions', {
	id: column.int().primaryKey().autoIncrement(),
	fromCharId: column.int().nullable(),
	toCharId: column.int().nullable(),
	type: column.string(20),
	amount: column.int(),
	reason: column.string(255).nullable(),
	createdAt: column.timestamp().defaultNow(),
})

export type TransactionType = 'cash' | 'bank'

/**
 * Initial migration for the banking module.
 *
 * Modules ship their own migrations and register them with the project's
 * MigrationRunner during bootstrap. The runner is idempotent so running
 * `nextvm db:migrate` after enabling banking is safe.
 */
export const bankingInitialMigration = defineMigration({
	name: '0001_create_banking_transactions',
	async up(db) {
		const builder = new SchemaBuilder(db.getAdapter())
		await db.raw(builder.createTable(transactionsTable))
	},
	async down(db) {
		const builder = new SchemaBuilder(db.getAdapter())
		await db.raw(builder.dropTable(transactionsTable))
	},
})
