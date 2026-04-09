import type { Database } from '@nextvm/db'
import type { LegacyPlayer, MigrationSource } from '../types'

/**
 * QBCore migration source.
 * QBCore schema:
 *   players(citizenid PRIMARY KEY, license VARCHAR, name VARCHAR,
 *           money JSON, charinfo JSON, job JSON, gang JSON,
 *           position JSON, metadata JSON, inventory JSON, last_updated)
 *   money:    { "cash": 500, "bank": 1000, "crypto": 0 }
 *   charinfo: { "firstname": "...", "lastname": "...", "birthdate": "...",
 *               "gender": 0, "nationality": "..." }
 *   job:      { "name": "...", "label": "...", "grade": { "level": N } }
 *   inventory: [{ "slot": 1, "name": "...", "amount": N, ... }]
 */
export class QbCoreMigrationSource implements MigrationSource {
	readonly framework = 'qbcore' as const

	constructor(private readonly db: Database) {}

	async count(): Promise<number> {
		const rows = await this.db.raw<{ c: number }>(
			'SELECT COUNT(*) AS c FROM players',
		)
		return rows[0]?.c ?? 0
	}

	async *listPlayers(): AsyncIterable<LegacyPlayer> {
		const rows = await this.db.raw<QbPlayerRow>(
			`SELECT citizenid, license, money, charinfo, job, position, inventory
			 FROM players`,
		)

		for (const row of rows) {
			yield mapQbRow(row)
		}
	}
}

interface QbPlayerRow {
	citizenid: string
	license: string | null
	money: string | null
	charinfo: string | null
	job: string | null
	position: string | null
	inventory: string | null
}

function mapQbRow(row: QbPlayerRow): LegacyPlayer {
	const money = parseJson<Record<string, number>>(row.money) ?? {}
	const charinfo =
		parseJson<{
			firstname?: string
			lastname?: string
			birthdate?: string
			gender?: number | string
		}>(row.charinfo) ?? {}
	const job =
		parseJson<{ name?: string; grade?: { level?: number } }>(row.job) ?? {}
	const position =
		parseJson<{ x?: number; y?: number; z?: number }>(row.position) ?? {}
	const inventory =
		parseJson<Array<{ name: string; amount: number; slot?: number }>>(row.inventory) ?? []

	return {
		identifier: row.license ?? `qb:${row.citizenid}`,
		discord: null,
		steam: null,
		firstName: charinfo.firstname ?? '',
		lastName: charinfo.lastname ?? '',
		dateOfBirth: charinfo.birthdate ?? null,
		gender: typeof charinfo.gender === 'number' ? String(charinfo.gender) : (charinfo.gender ?? null),
		cash: money.cash ?? 0,
		bank: money.bank ?? 0,
		job: job.name ?? 'unemployed',
		jobGrade: job.grade?.level ?? 0,
		position: {
			x: position.x ?? 0,
			y: position.y ?? 0,
			z: position.z ?? 0,
		},
		inventory: inventory.map((item) => ({
			name: item.name,
			count: item.amount,
			slot: item.slot,
		})),
		vehicles: [],
	}
}

function parseJson<T>(value: string | null): T | null {
	if (value === null || value === undefined) return null
	if (typeof value !== 'string') return value as T
	try {
		return JSON.parse(value) as T
	} catch {
		return null
	}
}
