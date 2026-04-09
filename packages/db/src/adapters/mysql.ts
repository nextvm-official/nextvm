import { createPool, type Pool, type PoolOptions, type RowDataPacket } from 'mysql2/promise'
import type { DatabaseAdapter } from '../adapter'

/**
 * MySQL/MariaDB Adapter — primary adapter for NextVM.
 *   "DB Primary: MySQL/MariaDB — Community compat (oxmysql)"
 * Uses mysql2/promise with connection pooling.
 */
export class MySqlAdapter implements DatabaseAdapter {
	readonly vendor = 'mysql'
	private pool: Pool

	constructor(optionsOrPool: PoolOptions | { pool: Pool }) {
		if ('pool' in optionsOrPool) {
			this.pool = optionsOrPool.pool
		} else {
			this.pool = createPool({
				waitForConnections: true,
				connectionLimit: 10,
				queueLimit: 0,
				...optionsOrPool,
			})
		}
	}

	/** Construct from an existing pool (e.g., shared with another resource) */
	static fromPool(pool: Pool): MySqlAdapter {
		return new MySqlAdapter({ pool })
	}

	async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
		const [rows] = await this.pool.query<RowDataPacket[]>(sql, params as never)
		return rows as T[]
	}

	async execute(
		sql: string,
		params: unknown[] = [],
	): Promise<{ affected: number; insertId: number }> {
		const [result] = await this.pool.execute(sql, params as never)
		const r = result as { affectedRows: number; insertId: number }
		return { affected: r.affectedRows, insertId: r.insertId }
	}

	async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
		const conn = await this.pool.getConnection()
		try {
			await conn.beginTransaction()
			const txAdapter: DatabaseAdapter = {
				vendor: 'mysql',
				quoteIdentifier: this.quoteIdentifier.bind(this),
				query: async <T2 = unknown>(sql: string, params: unknown[] = []) => {
					const [rows] = await conn.query<RowDataPacket[]>(sql, params as never)
					return rows as T2[]
				},
				execute: async (sql: string, params: unknown[] = []) => {
					const [result] = await conn.execute(sql, params as never)
					const r = result as { affectedRows: number; insertId: number }
					return { affected: r.affectedRows, insertId: r.insertId }
				},
				transaction: () => {
					throw new Error('Nested transactions are not supported')
				},
				close: async () => {
					/* no-op for tx */
				},
			}
			const result = await fn(txAdapter)
			await conn.commit()
			return result
		} catch (err) {
			await conn.rollback()
			throw err
		} finally {
			conn.release()
		}
	}

	async close(): Promise<void> {
		await this.pool.end()
	}

	quoteIdentifier(name: string): string {
		// Backtick-quote, escape inner backticks
		return `\`${name.replace(/`/g, '``')}\``
	}
}
