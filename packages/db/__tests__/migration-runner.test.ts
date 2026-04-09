import { describe, expect, it } from 'vitest'
import {
	type DatabaseAdapter,
	Database,
	defineMigration,
	MigrationRunner,
} from '../src'

/**
 * Minimal in-memory adapter that implements just enough of DatabaseAdapter
 * to drive the MigrationRunner against the nextv_migrations table.
 */
function buildInMemoryAdapter(): DatabaseAdapter {
	const tables = new Map<string, Array<Record<string, unknown>>>()
	let autoId = 0
	const ensure = (name: string) => {
		if (!tables.has(name)) tables.set(name, [])
		return tables.get(name)!
	}

	const adapter: DatabaseAdapter = {
		vendor: 'memory',
		quoteIdentifier: (name) => `\`${name}\``,
		async query<T = unknown>(sql: string, params: unknown[] = []) {
			// Very loose handling — only what the runner needs
			if (/SELECT.*FROM `nextv_migrations`/.test(sql)) {
				return ensure('nextv_migrations') as T[]
			}
			return [] as T[]
		},
		async execute(sql: string, params: unknown[] = []) {
			if (/CREATE TABLE.*nextv_migrations/.test(sql)) {
				ensure('nextv_migrations')
				return { affected: 0, insertId: 0 }
			}
			if (/INSERT INTO `nextv_migrations`/.test(sql)) {
				const name = params[0] as string
				autoId++
				ensure('nextv_migrations').push({
					id: autoId,
					name,
					appliedAt: new Date().toISOString(),
				})
				return { affected: 1, insertId: autoId }
			}
			if (/DELETE FROM `nextv_migrations`/.test(sql)) {
				const name = params[0] as string
				const list = ensure('nextv_migrations')
				const idx = list.findIndex((r) => r.name === name)
				if (idx !== -1) {
					list.splice(idx, 1)
					return { affected: 1, insertId: 0 }
				}
				return { affected: 0, insertId: 0 }
			}
			return { affected: 0, insertId: 0 }
		},
		async transaction(fn) {
			return fn(adapter)
		},
		async close() {},
	}
	return adapter
}

const migrationOps: string[] = []
const initial = defineMigration({
	name: '0001_initial',
	async up() {
		migrationOps.push('up:0001')
	},
	async down() {
		migrationOps.push('down:0001')
	},
})

const second = defineMigration({
	name: '0002_addcolumn',
	async up() {
		migrationOps.push('up:0002')
	},
	async down() {
		migrationOps.push('down:0002')
	},
})

describe('MigrationRunner', () => {
	it('migrates pending migrations in registration order', async () => {
		migrationOps.length = 0
		const db = new Database(buildInMemoryAdapter())
		const runner = new MigrationRunner(db)
		runner.add(initial)
		runner.add(second)

		const applied = await runner.migrate()
		expect(applied).toEqual(['0001_initial', '0002_addcolumn'])
		expect(migrationOps).toEqual(['up:0001', 'up:0002'])

		// Re-run is a no-op
		const second_run = await runner.migrate()
		expect(second_run).toEqual([])
	})

	it('rollback runs down() in reverse', async () => {
		migrationOps.length = 0
		const db = new Database(buildInMemoryAdapter())
		const runner = new MigrationRunner(db)
		runner.add(initial)
		runner.add(second)
		await runner.migrate()
		migrationOps.length = 0

		const rolled = await runner.rollback(2)
		expect(rolled).toEqual(['0002_addcolumn', '0001_initial'])
		expect(migrationOps).toEqual(['down:0002', 'down:0001'])
	})

	it('rejects duplicate migration names', () => {
		const db = new Database(buildInMemoryAdapter())
		const runner = new MigrationRunner(db)
		runner.add(initial)
		expect(() => runner.add(initial)).toThrow(/already registered/)
	})

	it('getPending returns only unapplied migrations', async () => {
		const db = new Database(buildInMemoryAdapter())
		const runner = new MigrationRunner(db)
		runner.add(initial)
		runner.add(second)
		await runner.migrate()
		const pending = await runner.getPending()
		expect(pending).toHaveLength(0)
	})
})
