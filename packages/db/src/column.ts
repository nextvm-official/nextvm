/**
 * Column definitions for table schemas.
 *   id: column.int().primaryKey().autoIncrement(),
 *   firstName: column.string(50),
 *   metadata: column.json().default({}),
 */

export type ColumnType =
	| 'int'
	| 'bigint'
	| 'string'
	| 'text'
	| 'boolean'
	| 'json'
	| 'timestamp'
	| 'datetime'
	| 'float'

export interface ColumnDefinition {
	type: ColumnType
	length?: number
	primaryKey: boolean
	autoIncrement: boolean
	nullable: boolean
	unique: boolean
	defaultValue: unknown
	hasDefault: boolean
	references: { table: string; column: string } | null
	__tsType?: unknown // phantom type marker for inference
}

/** Builder returned by column.* — supports a fluent API */
export class ColumnBuilder<T = unknown> {
	private def: ColumnDefinition

	constructor(type: ColumnType, length?: number) {
		this.def = {
			type,
			length,
			primaryKey: false,
			autoIncrement: false,
			nullable: false,
			unique: false,
			defaultValue: undefined,
			hasDefault: false,
			references: null,
		}
	}

	primaryKey(): this {
		this.def.primaryKey = true
		return this
	}

	autoIncrement(): this {
		this.def.autoIncrement = true
		return this
	}

	nullable(): ColumnBuilder<T | null> {
		this.def.nullable = true
		return this as unknown as ColumnBuilder<T | null>
	}

	unique(): this {
		this.def.unique = true
		return this
	}

	default(value: T): this {
		this.def.defaultValue = value
		this.def.hasDefault = true
		return this
	}

	defaultNow(): this {
		this.def.defaultValue = '__NOW__'
		this.def.hasDefault = true
		return this
	}

	/**
	 * Add a foreign key reference.
	 *   column.int().references('nextv_users.id')
	 * Also supports the explicit two-argument form for clarity:
	 *   column.int().references('nextv_users', 'id')
	 */
	references(tableOrPath: string, columnName?: string): this {
		if (columnName === undefined) {
			// Concept syntax: 'table.column'
			const dotIdx = tableOrPath.lastIndexOf('.')
			if (dotIdx === -1) {
				throw new Error(
					`references() expects 'table.column' or (table, column), got '${tableOrPath}'`,
				)
			}
			this.def.references = {
				table: tableOrPath.slice(0, dotIdx),
				column: tableOrPath.slice(dotIdx + 1),
			}
		} else {
			this.def.references = { table: tableOrPath, column: columnName }
		}
		return this
	}

	/** Internal: get the resolved column definition */
	build(): ColumnDefinition {
		return this.def
	}
}

/**
 * Column constructors — entry points for the fluent API.
 * Usage:
 *   id: column.int().primaryKey().autoIncrement()
 *   name: column.string(50)
 *   meta: column.json().default({})
 */
export const column = {
	int: () => new ColumnBuilder<number>('int'),
	bigint: () => new ColumnBuilder<number>('bigint'),
	float: () => new ColumnBuilder<number>('float'),
	string: (length = 255) => new ColumnBuilder<string>('string', length),
	text: () => new ColumnBuilder<string>('text'),
	boolean: () => new ColumnBuilder<boolean>('boolean'),
	json: <T = Record<string, unknown>>() => new ColumnBuilder<T>('json'),
	timestamp: () => new ColumnBuilder<Date>('timestamp'),
	datetime: () => new ColumnBuilder<Date>('datetime'),
} as const
