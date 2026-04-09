import type { DatabaseAdapter } from './adapter'
import type { ColumnDefinition } from './column'
import type { Table } from './define-table'

/**
 * SchemaBuilder — Generates CREATE TABLE / DROP TABLE SQL from Table definitions.
 * Used by the migration runner to materialize schemas defined via defineTable().
 * Currently emits MySQL-flavoured DDL. PostgreSQL adapter will provide its own.
 */
export class SchemaBuilder {
	constructor(private readonly adapter: DatabaseAdapter) {}

	/** Generate CREATE TABLE SQL for a table */
	createTable(table: Table): string {
		const cols: string[] = []
		const constraints: string[] = []

		for (const [name, def] of Object.entries(table.columns)) {
			cols.push(this.columnSql(name, def))
			if (def.references) {
				constraints.push(
					`FOREIGN KEY (${this.adapter.quoteIdentifier(name)}) REFERENCES ${this.adapter.quoteIdentifier(def.references.table)}(${this.adapter.quoteIdentifier(def.references.column)})`,
				)
			}
		}

		const all = [...cols, ...constraints].join(',\n  ')
		return `CREATE TABLE IF NOT EXISTS ${this.adapter.quoteIdentifier(table.name)} (\n  ${all}\n)`
	}

	/** Generate DROP TABLE SQL */
	dropTable(table: Table): string {
		return `DROP TABLE IF EXISTS ${this.adapter.quoteIdentifier(table.name)}`
	}

	private columnSql(name: string, def: ColumnDefinition): string {
		const parts: string[] = [this.adapter.quoteIdentifier(name), this.typeToSql(def)]
		if (!def.nullable) parts.push('NOT NULL')
		if (def.unique && !def.primaryKey) parts.push('UNIQUE')
		if (def.autoIncrement) parts.push('AUTO_INCREMENT')
		if (def.primaryKey) parts.push('PRIMARY KEY')
		if (def.hasDefault) {
			parts.push(`DEFAULT ${this.formatDefault(def.defaultValue)}`)
		}
		return parts.join(' ')
	}

	private typeToSql(def: ColumnDefinition): string {
		switch (def.type) {
			case 'int':
				return 'INT'
			case 'bigint':
				return 'BIGINT'
			case 'float':
				return 'FLOAT'
			case 'string':
				return `VARCHAR(${def.length ?? 255})`
			case 'text':
				return 'TEXT'
			case 'boolean':
				return 'TINYINT(1)'
			case 'json':
				return 'JSON'
			case 'timestamp':
				return 'TIMESTAMP'
			case 'datetime':
				return 'DATETIME'
		}
	}

	private formatDefault(value: unknown): string {
		if (value === '__NOW__') return 'CURRENT_TIMESTAMP'
		if (value === null) return 'NULL'
		if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
		if (typeof value === 'number' || typeof value === 'boolean') return String(Number(value))
		// JSON or object
		return `('${JSON.stringify(value).replace(/'/g, "''")}')`
	}
}
