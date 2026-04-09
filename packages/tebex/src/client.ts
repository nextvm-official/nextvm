import { type Fetcher, defaultFetcher } from './http'
import {
	type TebexPackage,
	tebexPackageSchema,
	type TebexTransaction,
	tebexTransactionSchema,
} from './schemas'

/**
 * TebexClient — typed wrapper around the Tebex Headless API.
 *
 * Concept v2.3, Chapter 4.3.3:
 *   "@nextvm/tebex provides typed integration with Tebex's server-side
 *    API (package fulfillment, gift cards, transaction verification)"
 *
 * GUARD-006: instance state, no globals.
 * GUARD-013: this is THE bridge modules use to comply with PLA — any
 * module that sells items to players for real money MUST go through here.
 */

export interface TebexClientOptions {
	/** Tebex secret key (NOT the public store identifier) */
	secret: string
	/** API base URL — override for staging / mock */
	baseUrl?: string
	/** Inject a custom fetcher (default: global fetch) */
	fetcher?: Fetcher
}

export class TebexClient {
	private readonly secret: string
	private readonly baseUrl: string
	private readonly fetcher: Fetcher

	constructor(opts: TebexClientOptions) {
		this.secret = opts.secret
		this.baseUrl = opts.baseUrl ?? 'https://plugin.tebex.io'
		this.fetcher = opts.fetcher ?? defaultFetcher
	}

	/** Fetch a single package by id */
	async getPackage(packageId: number): Promise<TebexPackage> {
		const data = await this.request('GET', `/packages/${packageId}`)
		const result = tebexPackageSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid Tebex package payload: ${result.error.message}`)
		}
		return result.data
	}

	/** List every package the store offers */
	async listPackages(): Promise<TebexPackage[]> {
		const data = await this.request('GET', '/packages')
		if (!Array.isArray(data)) {
			throw new Error('Tebex /packages did not return an array')
		}
		return data.map((entry) => {
			const parsed = tebexPackageSchema.safeParse(entry)
			if (!parsed.success) {
				throw new Error(`Invalid Tebex package entry: ${parsed.error.message}`)
			}
			return parsed.data
		})
	}

	/** Look up a transaction by its Tebex id */
	async getTransaction(transactionId: string): Promise<TebexTransaction> {
		const data = await this.request('GET', `/payments/${transactionId}`)
		const result = tebexTransactionSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid Tebex transaction payload: ${result.error.message}`)
		}
		return result.data
	}

	/**
	 * List recent transactions. Useful for the SaaS dashboard reconciliation
	 * job — fetch every payment since the last sync and replay them through
	 * the in-game fulfillment pipeline.
	 */
	async listRecentTransactions(): Promise<TebexTransaction[]> {
		const data = await this.request('GET', '/payments')
		if (!Array.isArray(data)) {
			throw new Error('Tebex /payments did not return an array')
		}
		return data.map((entry) => {
			const parsed = tebexTransactionSchema.safeParse(entry)
			if (!parsed.success) {
				throw new Error(`Invalid Tebex transaction entry: ${parsed.error.message}`)
			}
			return parsed.data
		})
	}

	private async request(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		path: string,
		body?: unknown,
	): Promise<unknown> {
		const headers: Record<string, string> = {
			'X-Tebex-Secret': this.secret,
			Accept: 'application/json',
		}
		if (body !== undefined) headers['Content-Type'] = 'application/json'

		const res = await this.fetcher({
			method,
			url: `${this.baseUrl}${path}`,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		})

		if (res.status >= 400) {
			throw new Error(`Tebex API error ${res.status}: ${res.body}`)
		}

		try {
			return JSON.parse(res.body)
		} catch {
			throw new Error(`Tebex returned non-JSON body (status ${res.status}): ${res.body}`)
		}
	}
}
