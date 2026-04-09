import type { DatabaseAdapter } from './adapter'
import type { InferRow, Table } from './define-table'

/**
 * Typed query builder.
 *   const player = await db.query(players)
 *     .where({ id: charId })
 *     .select('firstName', 'cash')
 *     .first()
 * Supports SELECT/INSERT/UPDATE/DELETE with type inference from table schemas.
 */

type Operator = '=' | '!=' | '<' | '<=' | '>' | '>='

interface WhereClause {
	column: string
	op: Operator
	value: unknown
}

export class SelectBuilder<T extends Table, TRow = InferRow<T>, TSelect = TRow> {
	private wheres: WhereClause[] = []
	private selectColumns: string[] | null = null
	private orderBy: { column: string; direction: 'ASC' | 'DESC' } | null = null
	private limitN: number | null = null
	private offsetN: number | null = null

	constructor(
		private readonly adapter: DatabaseAdapter,
		private readonly table: T,
	) {}

	/** Filter rows by an equality map or a single (column, op, value) triple */
	where(filter: Partial<TRow>): this
	where<K extends keyof TRow>(column: K, op: Operator, value: TRow[K]): this
	where(filterOrColumn: unknown, op?: Operator, value?: unknown): this {
		if (typeof filterOrColumn === 'object' && filterOrColumn !== null) {
			for (const [col, val] of Object.entries(filterOrColumn)) {
				this.wheres.push({ column: col, op: '=', value: val })
			}
		} else if (typeof filterOrColumn === 'string' && op !== undefined) {
			this.wheres.push({ column: filterOrColumn, op, value })
		}
		return this
	}

	/** Restrict the columns returned */
	select<K extends keyof TRow & string>(
		...columns: K[]
	): SelectBuilder<T, TRow, Pick<TRow, K>> {
		this.selectColumns = columns as string[]
		return this as unknown as SelectBuilder<T, TRow, Pick<TRow, K>>
	}

	orderByColumn<K extends keyof TRow & string>(
		column: K,
		direction: 'ASC' | 'DESC' = 'ASC',
	): this {
		this.orderBy = { column, direction }
		return this
	}

	limit(n: number): this {
		this.limitN = n
		return this
	}

	offset(n: number): this {
		this.offsetN = n
		return this
	}

	/** Execute and return all rows */
	async all(): Promise<TSelect[]> {
		const { sql, params } = this.toSql()
		return this.adapter.query<TSelect>(sql, params)
	}

	/** Execute and return the first row, or null */
	async first(): Promise<TSelect | null> {
		this.limitN = 1
		const rows = await this.all()
		return rows[0] ?? null
	}

	/** Execute COUNT(*) with the current filters */
	async count(): Promise<number> {
		const cols = '*'
		const where = this.buildWhere()
		const sql = `SELECT COUNT(${cols}) AS c FROM ${this.adapter.quoteIdentifier(this.table.name)}${where.sql}`
		const rows = await this.adapter.query<{ c: number }>(sql, where.params)
		return rows[0]?.c ?? 0
	}

	private toSql(): { sql: string; params: unknown[] } {
		const cols =
			this.selectColumns?.map((c) => this.adapter.quoteIdentifier(c)).join(', ') ?? '*'
		const tbl = this.adapter.quoteIdentifier(this.table.name)
		const where = this.buildWhere()
		let sql = `SELECT ${cols} FROM ${tbl}${where.sql}`
		if (this.orderBy) {
			sql += ` ORDER BY ${this.adapter.quoteIdentifier(this.orderBy.column)} ${this.orderBy.direction}`
		}
		if (this.limitN !== null) sql += ` LIMIT ${this.limitN}`
		if (this.offsetN !== null) sql += ` OFFSET ${this.offsetN}`
		return { sql, params: where.params }
	}

	private buildWhere(): { sql: string; params: unknown[] } {
		if (this.wheres.length === 0) return { sql: '', params: [] }
		const params: unknown[] = []
		const parts = this.wheres.map((w) => {
			params.push(w.value)
			return `${this.adapter.quoteIdentifier(w.column)} ${w.op} ?`
		})
		return { sql: ` WHERE ${parts.join(' AND ')}`, params }
	}
}

export class InsertBuilder<T extends Table, TRow = InferRow<T>> {
	constructor(
		private readonly adapter: DatabaseAdapter,
		private readonly table: T,
	) {}

	/** Insert a single row, returns the new row's primary key (insertId) */
	async one(values: Partial<TRow>): Promise<number> {
		const keys = Object.keys(values)
		const placeholders = keys.map(() => '?').join(', ')
		const cols = keys.map((k) => this.adapter.quoteIdentifier(k)).join(', ')
		const sql = `INSERT INTO ${this.adapter.quoteIdentifier(this.table.name)} (${cols}) VALUES (${placeholders})`
		const params = keys.map((k) => (values as Record<string, unknown>)[k])
		const result = await this.adapter.execute(sql, params)
		return result.insertId
	}

	/** Insert many rows, returns affected count */
	async many(rows: Array<Partial<TRow>>): Promise<number> {
		if (rows.length === 0) return 0
		let total = 0
		for (const row of rows) {
			await this.one(row)
			total++
		}
		return total
	}
}

export class UpdateBuilder<T extends Table, TRow = InferRow<T>> {
	private wheres: WhereClause[] = []

	constructor(
		private readonly adapter: DatabaseAdapter,
		private readonly table: T,
	) {}

	where(filter: Partial<TRow>): this {
		for (const [col, val] of Object.entries(filter)) {
			this.wheres.push({ column: col, op: '=', value: val })
		}
		return this
	}

	async set(values: Partial<TRow>): Promise<number> {
		const setKeys = Object.keys(values)
		if (setKeys.length === 0) return 0
		const setSql = setKeys
			.map((k) => `${this.adapter.quoteIdentifier(k)} = ?`)
			.join(', ')
		const setParams = setKeys.map((k) => (values as Record<string, unknown>)[k])

		const whereParts: string[] = []
		const whereParams: unknown[] = []
		for (const w of this.wheres) {
			whereParts.push(`${this.adapter.quoteIdentifier(w.column)} ${w.op} ?`)
			whereParams.push(w.value)
		}
		const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : ''
		const sql = `UPDATE ${this.adapter.quoteIdentifier(this.table.name)} SET ${setSql}${whereSql}`
		const result = await this.adapter.execute(sql, [...setParams, ...whereParams])
		return result.affected
	}
}

export class DeleteBuilder<T extends Table, TRow = InferRow<T>> {
	private wheres: WhereClause[] = []

	constructor(
		private readonly adapter: DatabaseAdapter,
		private readonly table: T,
	) {}

	where(filter: Partial<TRow>): this {
		for (const [col, val] of Object.entries(filter)) {
			this.wheres.push({ column: col, op: '=', value: val })
		}
		return this
	}

	async execute(): Promise<number> {
		const whereParts: string[] = []
		const whereParams: unknown[] = []
		for (const w of this.wheres) {
			whereParts.push(`${this.adapter.quoteIdentifier(w.column)} ${w.op} ?`)
			whereParams.push(w.value)
		}
		const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : ''
		const sql = `DELETE FROM ${this.adapter.quoteIdentifier(this.table.name)}${whereSql}`
		const result = await this.adapter.execute(sql, whereParams)
		return result.affected
	}
}
