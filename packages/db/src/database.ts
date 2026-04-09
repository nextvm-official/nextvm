import type { DatabaseAdapter } from './adapter'
import type { Table } from './define-table'
import {
	DeleteBuilder,
	InsertBuilder,
	SelectBuilder,
	UpdateBuilder,
} from './query-builder'

/**
 * Database — High-level facade over a DatabaseAdapter.
 *   const player = await db.query(players).where({ id: charId }).select(...).first()
 */
export class Database {
	constructor(private readonly adapter: DatabaseAdapter) {}

	/** Build a SELECT query against a table */
	query<T extends Table>(table: T): SelectBuilder<T> {
		return new SelectBuilder<T>(this.adapter, table)
	}

	/** Build an INSERT against a table */
	insert<T extends Table>(table: T): InsertBuilder<T> {
		return new InsertBuilder<T>(this.adapter, table)
	}

	/** Build an UPDATE against a table */
	update<T extends Table>(table: T): UpdateBuilder<T> {
		return new UpdateBuilder<T>(this.adapter, table)
	}

	/** Build a DELETE against a table */
	delete<T extends Table>(table: T): DeleteBuilder<T> {
		return new DeleteBuilder<T>(this.adapter, table)
	}

	/** Run a function inside a transaction */
	transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
		return this.adapter.transaction((txAdapter) => fn(new Database(txAdapter)))
	}

	/** Execute a raw SQL query (escape hatch) */
	raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
		return this.adapter.query<T>(sql, params)
	}

	/** Close the underlying connection */
	close(): Promise<void> {
		return this.adapter.close()
	}

	/** Get the underlying adapter (for migrations and admin tools) */
	getAdapter(): DatabaseAdapter {
		return this.adapter
	}
}
