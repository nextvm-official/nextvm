import type { Database } from '@nextvm/db'
import { transactionsTable, type TransactionType } from './schema'

/**
 * Lightweight balance ledger used by the banking module.
 * router can be exercised end-to-end without forcing every test to
 * stand up a real database. Production callers wire a Database via
 * setDatabase() and the audit trail flows into nextv_banking_transactions.
 */
export interface BalanceSnapshot {
	cash: number
	bank: number
}

export class BankingService {
	private balances = new Map<number, BalanceSnapshot>()
	private database: Database | null = null
	private nextTxId = 1

	constructor(opts?: { database?: Database }) {
		this.database = opts?.database ?? null
	}

	setDatabase(db: Database): void {
		this.database = db
	}

	/** Seed a character's balance (used by character load + tests) */
	seed(charId: number, snapshot: Partial<BalanceSnapshot>): void {
		this.balances.set(charId, {
			cash: snapshot.cash ?? 0,
			bank: snapshot.bank ?? 0,
		})
	}

	/** Get a character's balance, defaulting to zeros */
	get(charId: number): BalanceSnapshot {
		return this.balances.get(charId) ?? { cash: 0, bank: 0 }
	}

	/** Add money to one of a character's accounts (server-authoritative) */
	async addMoney(
		charId: number,
		type: TransactionType,
		amount: number,
		reason?: string,
	): Promise<number> {
		if (amount <= 0) throw new Error('amount must be positive')
		const balance = this.get(charId)
		balance[type] += amount
		this.balances.set(charId, balance)
		await this.recordTx({ fromCharId: null, toCharId: charId, type, amount, reason })
		return balance[type]
	}

	/** Remove money. Returns the new balance, throws if insufficient. */
	async removeMoney(
		charId: number,
		type: TransactionType,
		amount: number,
		reason?: string,
	): Promise<number> {
		if (amount <= 0) throw new Error('amount must be positive')
		const balance = this.get(charId)
		if (balance[type] < amount) {
			throw new Error('INSUFFICIENT_FUNDS')
		}
		balance[type] -= amount
		this.balances.set(charId, balance)
		await this.recordTx({ fromCharId: charId, toCharId: null, type, amount, reason })
		return balance[type]
	}

	/**
	 * Atomic transfer between two characters.
	 * If the receiver fails, the sender is refunded.
	 */
	async transfer(
		fromCharId: number,
		toCharId: number,
		type: TransactionType,
		amount: number,
		reason?: string,
	): Promise<{ txId: number }> {
		if (fromCharId === toCharId) throw new Error('cannot transfer to self')
		await this.removeMoney(fromCharId, type, amount, reason)
		try {
			await this.addMoney(toCharId, type, amount, reason)
		} catch (err) {
			// rollback the deduction
			await this.addMoney(fromCharId, type, amount, 'rollback')
			throw err
		}
		const txId = this.nextTxId++
		await this.recordTx({ fromCharId, toCharId, type, amount, reason })
		return { txId }
	}

	/** Forget all in-memory balances (test helper) */
	clear(): void {
		this.balances.clear()
		this.nextTxId = 1
	}

	private async recordTx(entry: {
		fromCharId: number | null
		toCharId: number | null
		type: TransactionType
		amount: number
		reason?: string
	}): Promise<void> {
		if (!this.database) return
		await this.database.insert(transactionsTable).one({
			fromCharId: entry.fromCharId,
			toCharId: entry.toCharId,
			type: entry.type,
			amount: entry.amount,
			reason: entry.reason ?? null,
		})
	}
}
