import type { Database } from '../database'

/**
 * Migration definition.
 *   nextvm db:generate / db:migrate / db:rollback / db:seed
 */
export interface Migration {
	/** Unique name — used for ordering and tracking */
	name: string
	/** Run forward */
	up: (db: Database) => Promise<void>
	/** Run backward */
	down: (db: Database) => Promise<void>
}

/** Tracking row in nextv_migrations */
export interface MigrationRecord {
	id: number
	name: string
	appliedAt: Date
}
