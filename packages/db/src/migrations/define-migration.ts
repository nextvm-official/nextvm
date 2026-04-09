import type { Migration } from './types'

/**
 * Define a migration with type inference.
 *   export default defineMigration({
 *     name: '0001_initial',
 *     up: async (db) => { await db.raw('CREATE TABLE ...') },
 *     down: async (db) => { await db.raw('DROP TABLE ...') },
 *   })
 */
export function defineMigration(migration: Migration): Migration {
	return migration
}
