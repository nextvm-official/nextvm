import { describe, expect, it, vi } from 'vitest'
import { type Fetcher, TebexClient } from '../src'

const buildClient = (responses: Record<string, { status: number; body: unknown }>) => {
	const fetcher: Fetcher = vi.fn(async (req) => {
		const key = `${req.method} ${req.url}`
		const r = responses[key]
		if (!r) throw new Error(`Unmocked request: ${key}`)
		return { status: r.status, body: JSON.stringify(r.body) }
	})
	const client = new TebexClient({
		secret: 'sk_test',
		baseUrl: 'https://mock.tebex',
		fetcher,
	})
	return { client, fetcher }
}

describe('TebexClient', () => {
	it('getPackage parses the typed response', async () => {
		const { client } = buildClient({
			'GET https://mock.tebex/packages/42': {
				status: 200,
				body: {
					id: 42,
					name: 'VIP',
					base_price: 9.99,
					total_price: 9.99,
					currency: 'USD',
				},
			},
		})
		const pkg = await client.getPackage(42)
		expect(pkg.id).toBe(42)
		expect(pkg.name).toBe('VIP')
		expect(pkg.currency).toBe('USD')
	})

	it('listPackages parses an array', async () => {
		const { client } = buildClient({
			'GET https://mock.tebex/packages': {
				status: 200,
				body: [
					{ id: 1, name: 'VIP', base_price: 5, total_price: 5, currency: 'USD' },
					{ id: 2, name: 'MVP', base_price: 10, total_price: 10, currency: 'USD' },
				],
			},
		})
		const packages = await client.listPackages()
		expect(packages).toHaveLength(2)
		expect(packages[1]?.name).toBe('MVP')
	})

	it('throws on non-200 with the body included', async () => {
		const { client } = buildClient({
			'GET https://mock.tebex/packages/99': {
				status: 404,
				body: { error: 'not found' },
			},
		})
		await expect(client.getPackage(99)).rejects.toThrow(/404/)
	})

	it('throws on payload schema mismatch', async () => {
		const { client } = buildClient({
			'GET https://mock.tebex/packages/1': {
				status: 200,
				body: { id: 1 }, // missing required fields
			},
		})
		await expect(client.getPackage(1)).rejects.toThrow(/Invalid Tebex package/)
	})

	it('sends the X-Tebex-Secret header on every request', async () => {
		const { client, fetcher } = buildClient({
			'GET https://mock.tebex/packages/1': {
				status: 200,
				body: {
					id: 1,
					name: 'VIP',
					base_price: 5,
					total_price: 5,
					currency: 'USD',
				},
			},
		})
		await client.getPackage(1)
		expect(fetcher).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ 'X-Tebex-Secret': 'sk_test' }),
			}),
		)
	})
})
