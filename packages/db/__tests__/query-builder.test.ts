import { describe, expect, it } from 'vitest'
import {
	column,
	type DatabaseAdapter,
	defineTable,
	DeleteBuilder,
	InsertBuilder,
	SelectBuilder,
	UpdateBuilder,
} from '../src'

interface CapturedQuery {
	sql: string
	params: unknown[]
}

const buildAdapter = (rows: Array<Record<string, unknown>> = []) => {
	const captured: CapturedQuery[] = []
	const executes: CapturedQuery[] = []
	const adapter: DatabaseAdapter = {
		vendor: 'mock',
		quoteIdentifier: (name) => `\`${name}\``,
		async query(sql, params = []) {
			captured.push({ sql, params })
			return rows as never
		},
		async execute(sql, params = []) {
			executes.push({ sql, params })
			return { affected: 1, insertId: 42 }
		},
		async transaction(fn) {
			return fn(adapter)
		},
		async close() {},
	}
	return { adapter, captured, executes }
}

const usersTable = defineTable('nextv_users', {
	id: column.int().primaryKey().autoIncrement(),
	license: column.string(50),
	cash: column.int().default(0),
})

describe('SelectBuilder', () => {
	it('generates a SELECT * with no filters', async () => {
		const { adapter, captured } = buildAdapter()
		const sb = new SelectBuilder(adapter, usersTable)
		await sb.all()
		expect(captured[0]?.sql).toBe('SELECT * FROM `nextv_users`')
		expect(captured[0]?.params).toEqual([])
	})

	it('adds WHERE clauses from object filter', async () => {
		const { adapter, captured } = buildAdapter()
		await new SelectBuilder(adapter, usersTable).where({ id: 1, license: 'foo' }).all()
		expect(captured[0]?.sql).toBe(
			'SELECT * FROM `nextv_users` WHERE `id` = ? AND `license` = ?',
		)
		expect(captured[0]?.params).toEqual([1, 'foo'])
	})

	it('supports column-level operator', async () => {
		const { adapter, captured } = buildAdapter()
		await new SelectBuilder(adapter, usersTable).where('cash', '>', 100).all()
		expect(captured[0]?.sql).toBe('SELECT * FROM `nextv_users` WHERE `cash` > ?')
		expect(captured[0]?.params).toEqual([100])
	})

	it('select() restricts the column list', async () => {
		const { adapter, captured } = buildAdapter()
		await new SelectBuilder(adapter, usersTable).select('id', 'license').all()
		expect(captured[0]?.sql).toBe('SELECT `id`, `license` FROM `nextv_users`')
	})

	it('first() applies LIMIT 1', async () => {
		const { adapter, captured } = buildAdapter([{ id: 1 }])
		await new SelectBuilder(adapter, usersTable).first()
		expect(captured[0]?.sql).toContain('LIMIT 1')
	})

	it('returns null from first() on empty result', async () => {
		const { adapter } = buildAdapter([])
		const result = await new SelectBuilder(adapter, usersTable).first()
		expect(result).toBeNull()
	})
})

describe('InsertBuilder', () => {
	it('one() generates an INSERT and returns the insertId', async () => {
		const { adapter, executes } = buildAdapter()
		const id = await new InsertBuilder(adapter, usersTable).one({
			license: 'foo',
			cash: 100,
		})
		expect(executes[0]?.sql).toBe(
			'INSERT INTO `nextv_users` (`license`, `cash`) VALUES (?, ?)',
		)
		expect(executes[0]?.params).toEqual(['foo', 100])
		expect(id).toBe(42)
	})
})

describe('UpdateBuilder', () => {
	it('set() generates UPDATE with WHERE clause', async () => {
		const { adapter, executes } = buildAdapter()
		const affected = await new UpdateBuilder(adapter, usersTable)
			.where({ id: 1 })
			.set({ cash: 200 })
		expect(executes[0]?.sql).toBe('UPDATE `nextv_users` SET `cash` = ? WHERE `id` = ?')
		expect(executes[0]?.params).toEqual([200, 1])
		expect(affected).toBe(1)
	})

	it('set() with no values returns 0 without executing', async () => {
		const { adapter, executes } = buildAdapter()
		const affected = await new UpdateBuilder(adapter, usersTable).where({ id: 1 }).set({})
		expect(affected).toBe(0)
		expect(executes).toHaveLength(0)
	})
})

describe('DeleteBuilder', () => {
	it('execute() generates DELETE with WHERE', async () => {
		const { adapter, executes } = buildAdapter()
		await new DeleteBuilder(adapter, usersTable).where({ id: 1 }).execute()
		expect(executes[0]?.sql).toBe('DELETE FROM `nextv_users` WHERE `id` = ?')
		expect(executes[0]?.params).toEqual([1])
	})

	it('execute() without WHERE deletes everything', async () => {
		const { adapter, executes } = buildAdapter()
		await new DeleteBuilder(adapter, usersTable).execute()
		expect(executes[0]?.sql).toBe('DELETE FROM `nextv_users`')
	})
})
