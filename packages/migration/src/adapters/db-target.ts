import type { Database } from '@nextvm/db'
import { charactersTable, usersTable } from '@nextvm/db'
import type { MigrationTarget } from '../types'

/**
 * DbMigrationTarget — production target backed by an @nextvm/db Database.
 * Writes into the standard nextv_users + nextv_characters tables.
 * Migrations against this target write real rows into MySQL — make
 * sure the schema migrations have been applied first via
 * `nextvm db:migrate`.
 */
export class DbMigrationTarget implements MigrationTarget {
	constructor(private readonly db: Database) {}

	async insertUser(input: {
		license: string
		discord: string | null
		steam: string | null
	}): Promise<{ id: number }> {
		const id = await this.db.insert(usersTable).one({
			license: input.license,
			discord: input.discord,
			steam: input.steam,
		})
		return { id }
	}

	async insertCharacter(input: {
		userId: number
		slot: number
		firstName: string
		lastName: string
		dateOfBirth: string | null
		gender: string | null
		cash: number
		bank: number
		job: string
		position: { x: number; y: number; z: number }
		inventoryJson: string
		metadataJson: string
	}): Promise<{ id: number }> {
		const id = await this.db.insert(charactersTable).one({
			userId: input.userId,
			slot: input.slot,
			firstName: input.firstName,
			lastName: input.lastName,
			dateOfBirth: input.dateOfBirth ?? '',
			gender: input.gender ?? '',
			cash: input.cash,
			bank: input.bank,
			job: input.job,
			position: input.position,
			appearance: {},
			metadata: parseJsonOrEmpty(input.metadataJson),
		})
		return { id }
	}

	async close(): Promise<void> {
		await this.db.close()
	}
}

function parseJsonOrEmpty(json: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(json)
		return typeof parsed === 'object' && parsed !== null
			? (parsed as Record<string, unknown>)
			: {}
	} catch {
		return {}
	}
}
