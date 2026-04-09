import type { Database } from '../database'
import type { Migration } from './types'

/**
 * MigrationRunner — Applies and rolls back migrations.
 *   "Migration CLI: nextvm db:generate, nextvm db:migrate,
 *    nextvm db:rollback, nextvm db:seed"
 * Tracks applied migrations in `nextv_migrations` table.
 */
export class MigrationRunner {
	private migrations: Migration[] = []

	constructor(private readonly db: Database) {}

	/** Register a migration. Order is the registration order. */
	add(migration: Migration): void {
		if (this.migrations.some((m) => m.name === migration.name)) {
			throw new Error(`Migration '${migration.name}' is already registered`)
		}
		this.migrations.push(migration)
	}

	/** Register many migrations at once */
	addAll(migrations: Migration[]): void {
		for (const m of migrations) this.add(m)
	}

	/** Ensure the migrations tracking table exists */
	private async ensureTrackingTable(): Promise<void> {
		const adapter = this.db.getAdapter()
		await adapter.execute(`
			CREATE TABLE IF NOT EXISTS ${adapter.quoteIdentifier('nextv_migrations')} (
				${adapter.quoteIdentifier('id')} INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				${adapter.quoteIdentifier('name')} VARCHAR(255) NOT NULL UNIQUE,
				${adapter.quoteIdentifier('appliedAt')} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`)
	}

	/** Get the names of all already-applied migrations */
	async getApplied(): Promise<string[]> {
		await this.ensureTrackingTable()
		const adapter = this.db.getAdapter()
		const rows = await adapter.query<{ name: string }>(
			`SELECT ${adapter.quoteIdentifier('name')} FROM ${adapter.quoteIdentifier('nextv_migrations')} ORDER BY ${adapter.quoteIdentifier('id')} ASC`,
		)
		return rows.map((r) => r.name)
	}

	/** Get migrations that are pending (not yet applied) */
	async getPending(): Promise<Migration[]> {
		const applied = new Set(await this.getApplied())
		return this.migrations.filter((m) => !applied.has(m.name))
	}

	/**
	 * Apply all pending migrations.
	 * Returns the names of migrations that were applied.
	 */
	async migrate(): Promise<string[]> {
		const pending = await this.getPending()
		const applied: string[] = []
		const adapter = this.db.getAdapter()

		for (const migration of pending) {
			await migration.up(this.db)
			await adapter.execute(
				`INSERT INTO ${adapter.quoteIdentifier('nextv_migrations')} (${adapter.quoteIdentifier('name')}) VALUES (?)`,
				[migration.name],
			)
			applied.push(migration.name)
		}

		return applied
	}

	/**
	 * Roll back the most recent migration (or N migrations).
	 * Returns the names of migrations that were rolled back.
	 */
	async rollback(steps = 1): Promise<string[]> {
		const applied = await this.getApplied()
		const toRollback = applied.slice(-steps).reverse()
		const adapter = this.db.getAdapter()
		const rolledBack: string[] = []

		for (const name of toRollback) {
			const migration = this.migrations.find((m) => m.name === name)
			if (!migration) {
				throw new Error(`Cannot rollback '${name}': migration definition not found`)
			}
			await migration.down(this.db)
			await adapter.execute(
				`DELETE FROM ${adapter.quoteIdentifier('nextv_migrations')} WHERE ${adapter.quoteIdentifier('name')} = ?`,
				[name],
			)
			rolledBack.push(name)
		}

		return rolledBack
	}
}
