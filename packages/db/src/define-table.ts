import type { ColumnBuilder, ColumnDefinition } from './column'

/**
 * Table schema — a record of column builders.
 *   export const users = defineTable('nextv_users', {
 *     id: column.int().primaryKey().autoIncrement(),
 *     license: column.string(50).unique(),
 *     ...
 *   })
 */

export type TableSchema = Record<string, ColumnBuilder<unknown>>

/** Internal table representation built from defineTable() */
export interface Table<TSchema extends TableSchema = TableSchema> {
	name: string
	schema: TSchema
	/** Resolved column definitions (cached at define time) */
	columns: Record<string, ColumnDefinition>
}

/**
 * Infer the row TypeScript type from a table schema.
 * Each column builder carries a phantom type T that we extract here:
 *   defineTable('users', { id: column.int(), name: column.string() })
 *   → { id: number, name: string }
 */
export type InferRow<T extends Table> = {
	[K in keyof T['schema']]: T['schema'][K] extends ColumnBuilder<infer V> ? V : never
}

/**
 * Define a typed table.
 */
export function defineTable<TSchema extends TableSchema>(
	name: string,
	schema: TSchema,
): Table<TSchema> {
	const columns: Record<string, ColumnDefinition> = {}
	for (const [key, builder] of Object.entries(schema)) {
		columns[key] = builder.build()
	}
	return { name, schema, columns }
}
