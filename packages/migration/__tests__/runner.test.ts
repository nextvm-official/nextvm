import { describe, expect, it } from 'vitest'
import {
	formatReport,
	InMemoryMigrationSource,
	InMemoryMigrationTarget,
	type LegacyPlayer,
	runMigration,
} from '../src'

const player = (overrides: Partial<LegacyPlayer> = {}): LegacyPlayer => ({
	identifier: 'license:abc',
	discord: null,
	steam: null,
	firstName: 'John',
	lastName: 'Doe',
	dateOfBirth: '1990-01-01',
	gender: 'm',
	cash: 500,
	bank: 1000,
	job: 'unemployed',
	jobGrade: 0,
	position: { x: 0, y: 0, z: 0 },
	inventory: [],
	vehicles: [],
	...overrides,
})

describe('runMigration', () => {
	it('inserts users + characters for every healthy row', async () => {
		const source = new InMemoryMigrationSource([
			player({ identifier: 'license:abc' }),
			player({ identifier: 'license:def', firstName: 'Jane' }),
		])
		const target = new InMemoryMigrationTarget()
		const report = await runMigration(source, target)

		expect(report.totalRowsRead).toBe(2)
		expect(report.usersInserted).toBe(2)
		expect(report.charactersInserted).toBe(2)
		expect(report.skipped).toBe(0)
		expect(report.errors).toEqual([])
		expect(target.users).toHaveLength(2)
		expect(target.characters).toHaveLength(2)
	})

	it('normalizes the license identifier', async () => {
		const source = new InMemoryMigrationSource([
			player({ identifier: 'license:abc' }),
			player({ identifier: 'def' }),
		])
		const target = new InMemoryMigrationTarget()
		await runMigration(source, target)
		expect(target.users.map((u) => u.license)).toEqual([
			'license:abc',
			'license:def',
		])
	})

	it('skips rows with missing required fields by default', async () => {
		const source = new InMemoryMigrationSource([
			player({ firstName: '' }),
			player({ identifier: 'license:ok' }),
		])
		const target = new InMemoryMigrationTarget()
		const report = await runMigration(source, target)
		expect(report.skipped).toBe(1)
		expect(report.usersInserted).toBe(1)
		expect(report.warnings).toHaveLength(1)
		expect(report.warnings[0]?.message).toContain('firstName')
	})

	it('dryRun does not write to the target', async () => {
		const source = new InMemoryMigrationSource([player()])
		const target = new InMemoryMigrationTarget()
		const report = await runMigration(source, target, { dryRun: true })
		expect(report.dryRun).toBe(true)
		expect(report.usersInserted).toBe(1) // counted as if-inserted
		expect(target.users).toHaveLength(0)
		expect(target.characters).toHaveLength(0)
	})

	it('captures the inventory + metadata as JSON strings', async () => {
		const source = new InMemoryMigrationSource([
			player({
				inventory: [
					{ name: 'water_bottle', count: 3 },
					{ name: 'phone', count: 1 },
				],
				vehicles: [{ plate: 'ABC123', model: 'adder' }],
				jobGrade: 2,
			}),
		])
		const target = new InMemoryMigrationTarget()
		await runMigration(source, target)
		const char = target.characters[0]!
		expect(JSON.parse(char.inventoryJson)).toEqual([
			{ name: 'water_bottle', count: 3 },
			{ name: 'phone', count: 1 },
		])
		const meta = JSON.parse(char.metadataJson) as {
			vehicles: Array<{ plate: string }>
			jobGrade: number
		}
		expect(meta.vehicles[0]?.plate).toBe('ABC123')
		expect(meta.jobGrade).toBe(2)
	})

	it('onProgress is called once per row', async () => {
		const players = [player(), player(), player()]
		const source = new InMemoryMigrationSource(players)
		const target = new InMemoryMigrationTarget()
		const calls: Array<[number, number]> = []
		await runMigration(source, target, {
			onProgress: (cur, total) => calls.push([cur, total]),
		})
		expect(calls).toEqual([
			[1, 3],
			[2, 3],
			[3, 3],
		])
	})

	it('formatReport renders a human-readable summary', async () => {
		const source = new InMemoryMigrationSource([player()])
		const target = new InMemoryMigrationTarget()
		const report = await runMigration(source, target)
		const text = formatReport(report)
		expect(text).toContain('Migration from memory')
		expect(text).toContain('Users:      1')
		expect(text).toContain('Characters: 1')
	})

	it('reports errors with the offending identifier', async () => {
		// Build a target whose insertCharacter throws
		const source = new InMemoryMigrationSource([player({ identifier: 'license:bad' })])
		const target = new InMemoryMigrationTarget()
		// monkey-patch insertCharacter to throw
		target.insertCharacter = async () => {
			throw new Error('disk full')
		}
		const report = await runMigration(source, target)
		expect(report.errors).toHaveLength(1)
		expect(report.errors[0]?.identifier).toBe('license:bad')
		expect(report.errors[0]?.message).toBe('disk full')
	})
})
