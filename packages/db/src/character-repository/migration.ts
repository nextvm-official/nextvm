import { defineMigration } from '../migrations/define-migration'
import { SchemaBuilder } from '../schema-builder'
import { charactersTable, usersTable } from './schema'

/**
 * Initial migration for the NextVM character system.
 *
 * Concept v2.3, Chapter 9.3:
 *   Creates nextv_users and nextv_characters tables.
 */
export const initialCharacterMigration = defineMigration({
	name: '0001_create_character_tables',
	async up(db) {
		const builder = new SchemaBuilder(db.getAdapter())
		await db.raw(builder.createTable(usersTable))
		await db.raw(builder.createTable(charactersTable))
	},
	async down(db) {
		const builder = new SchemaBuilder(db.getAdapter())
		// Drop characters first (FK to users)
		await db.raw(builder.dropTable(charactersTable))
		await db.raw(builder.dropTable(usersTable))
	},
})
