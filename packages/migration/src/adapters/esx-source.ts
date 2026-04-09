import type { Database } from '@nextvm/db'
import type { LegacyPlayer, MigrationSource } from '../types'

/**
 * ESX migration source.
 *
 * Concept v2.3, Chapter 16.2 — reads from the standard ESX 1.x schema.
 *
 * ESX schema (Standard 1.x):
 *   users(identifier VARCHAR(60), accounts JSON, group VARCHAR,
 *         inventory JSON, position JSON, firstname, lastname,
 *         dateofbirth, sex, height, job, job_grade)
 *   accounts: { "money": 500, "bank": 1000, "black_money": 0 }
 *   inventory: [{ "name": "...", "label": "...", "count": N, "type": "..." }]
 *   owned_vehicles(owner, plate, vehicle JSON, type, job, stored)
 *
 * GUARD-006: instance state, no globals.
 */
export class EsxMigrationSource implements MigrationSource {
	readonly framework = 'esx' as const

	constructor(private readonly db: Database) {}

	async count(): Promise<number> {
		const rows = await this.db.raw<{ c: number }>(
			'SELECT COUNT(*) AS c FROM users',
		)
		return rows[0]?.c ?? 0
	}

	async *listPlayers(): AsyncIterable<LegacyPlayer> {
		const rows = await this.db.raw<EsxUserRow>(
			`SELECT identifier, accounts, inventory, position,
			        firstname, lastname, dateofbirth, sex,
			        job, job_grade
			 FROM users`,
		)

		// Pre-fetch all owned vehicles indexed by owner so we don't N+1 the join
		const vehicleRows = await this.db.raw<EsxVehicleRow>(
			'SELECT owner, plate, vehicle FROM owned_vehicles',
		).catch(() => [] as EsxVehicleRow[])

		const vehiclesByOwner = new Map<string, EsxVehicleRow[]>()
		for (const v of vehicleRows) {
			const list = vehiclesByOwner.get(v.owner) ?? []
			list.push(v)
			vehiclesByOwner.set(v.owner, list)
		}

		for (const row of rows) {
			yield mapEsxRow(row, vehiclesByOwner.get(row.identifier) ?? [])
		}
	}
}

interface EsxUserRow {
	identifier: string
	accounts: string | null
	inventory: string | null
	position: string | null
	firstname: string | null
	lastname: string | null
	dateofbirth: string | null
	sex: string | null
	job: string | null
	job_grade: number | null
}

interface EsxVehicleRow {
	owner: string
	plate: string
	vehicle: string | null
}

function mapEsxRow(row: EsxUserRow, vehicles: EsxVehicleRow[]): LegacyPlayer {
	const accounts = parseJson<Record<string, number>>(row.accounts) ?? {}
	const inventory = parseJson<Array<{ name: string; count: number }>>(row.inventory) ?? []
	const position = parseJson<{ x?: number; y?: number; z?: number }>(row.position) ?? {}

	return {
		identifier: row.identifier,
		discord: extractIdentifierPart(row.identifier, 'discord'),
		steam: extractIdentifierPart(row.identifier, 'steam'),
		firstName: row.firstname ?? '',
		lastName: row.lastname ?? '',
		dateOfBirth: row.dateofbirth,
		gender: row.sex,
		cash: accounts.money ?? 0,
		bank: accounts.bank ?? 0,
		job: row.job ?? 'unemployed',
		jobGrade: row.job_grade ?? 0,
		position: {
			x: position.x ?? 0,
			y: position.y ?? 0,
			z: position.z ?? 0,
		},
		inventory: inventory.map((item) => ({
			name: item.name,
			count: item.count,
		})),
		vehicles: vehicles.map((v) => {
			const data = parseJson<{ model?: string; modelhash?: string }>(v.vehicle) ?? {}
			return {
				plate: v.plate,
				model: data.model ?? data.modelhash ?? 'unknown',
			}
		}),
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

/**
 * ESX often crams multiple identifier strings into one (e.g. an array
 * stringified into the `identifier` column). When that happens, callers
 * can extract a specific prefix; otherwise we return null.
 */
function extractIdentifierPart(identifier: string, prefix: 'discord' | 'steam'): string | null {
	const match = identifier.match(new RegExp(`${prefix}:[^\\s,;]+`))
	return match ? match[0] : null
}
