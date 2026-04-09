/**
 * Database Adapter interface.
 *
 * The query builder is adapter-agnostic. Adapters translate the
 * neutral query representation into vendor-specific SQL.
 */

export interface PreparedQuery {
	sql: string
	params: unknown[]
}

export interface DatabaseAdapter {
	/** Execute a query and return all rows */
	query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
	/** Execute a write and return affected row count + insert id */
	execute(sql: string, params?: unknown[]): Promise<{ affected: number; insertId: number }>
	/** Run a function inside a transaction */
	transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>
	/** Close the underlying connection / pool */
	close(): Promise<void>
	/** Vendor identifier (e.g., 'mysql', 'postgres') */
	readonly vendor: string
	/** Quote an identifier (table or column name) for the dialect */
	quoteIdentifier(name: string): string
}
