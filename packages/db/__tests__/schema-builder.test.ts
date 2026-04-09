import { describe, expect, it } from 'vitest'
import { column, type DatabaseAdapter, defineTable, SchemaBuilder } from '../src'

const adapter: DatabaseAdapter = {
	vendor: 'mock',
	quoteIdentifier: (name) => `\`${name}\``,
	async query() {
		return []
	},
	async execute() {
		return { affected: 0, insertId: 0 }
	},
	async transaction(fn) {
		return fn(adapter)
	},
	async close() {},
}

describe('SchemaBuilder', () => {
	it('generates CREATE TABLE for a simple schema', () => {
		const users = defineTable('nextv_users', {
			id: column.int().primaryKey().autoIncrement(),
			license: column.string(50).unique(),
			banned: column.boolean().default(false),
		})
		const sql = new SchemaBuilder(adapter).createTable(users)
		expect(sql).toContain('CREATE TABLE IF NOT EXISTS `nextv_users`')
		expect(sql).toContain('`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY')
		expect(sql).toContain('`license` VARCHAR(50) NOT NULL UNIQUE')
		expect(sql).toContain('`banned` TINYINT(1) NOT NULL DEFAULT 0')
	})

	it('handles foreign-key references', () => {
		const characters = defineTable('nextv_characters', {
			id: column.int().primaryKey().autoIncrement(),
			userId: column.int().references('nextv_users.id'),
		})
		const sql = new SchemaBuilder(adapter).createTable(characters)
		expect(sql).toContain('FOREIGN KEY (`userId`) REFERENCES `nextv_users`(`id`)')
	})

	it('emits CURRENT_TIMESTAMP for defaultNow()', () => {
		const t = defineTable('nextv_logs', {
			id: column.int().primaryKey().autoIncrement(),
			createdAt: column.timestamp().defaultNow(),
		})
		const sql = new SchemaBuilder(adapter).createTable(t)
		expect(sql).toContain('DEFAULT CURRENT_TIMESTAMP')
	})

	it('serializes JSON defaults', () => {
		const t = defineTable('nextv_meta', {
			id: column.int().primaryKey().autoIncrement(),
			data: column.json().default({ foo: 'bar' }),
		})
		const sql = new SchemaBuilder(adapter).createTable(t)
		expect(sql).toContain('DEFAULT')
		expect(sql).toContain('foo')
	})

	it('supports nullable columns', () => {
		const t = defineTable('nextv_test', {
			id: column.int().primaryKey().autoIncrement(),
			optional: column.string(50).nullable(),
		})
		const sql = new SchemaBuilder(adapter).createTable(t)
		expect(sql).toContain('`optional` VARCHAR(50)')
		expect(sql).not.toContain('`optional` VARCHAR(50) NOT NULL')
	})

	it('dropTable produces DROP IF EXISTS', () => {
		const t = defineTable('nextv_temp', {
			id: column.int().primaryKey().autoIncrement(),
		})
		const sql = new SchemaBuilder(adapter).dropTable(t)
		expect(sql).toBe('DROP TABLE IF EXISTS `nextv_temp`')
	})
})
