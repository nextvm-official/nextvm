import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { type Fetcher, RegistryClient } from '../src'

const buildClient = (
	responses: Record<string, { status: number; body: unknown }>,
	opts: { token?: string } = {},
) => {
	const fetcher: Fetcher = vi.fn(async (req) => {
		const key = `${req.method} ${req.url}`
		const r = responses[key]
		if (!r) throw new Error(`Unmocked request: ${key}`)
		const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
		return { status: r.status, body }
	})
	const client = new RegistryClient({
		baseUrl: 'https://mock.registry',
		fetcher,
		token: opts.token,
	})
	return { client, fetcher }
}

describe('RegistryClient', () => {
	it('search returns typed listings', async () => {
		const { client } = buildClient({
			'GET https://mock.registry/search?q=banking': {
				status: 200,
				body: {
					results: [
						{
							name: '@nextvm-community/loans',
							latestVersion: '1.2.0',
							tags: ['finance'],
							premium: false,
							priceUsd: null,
							downloads: 42,
						},
					],
					total: 1,
				},
			},
		})
		const result = await client.search('banking')
		expect(result.total).toBe(1)
		expect(result.results[0]?.name).toBe('@nextvm-community/loans')
	})

	it('getModule fetches a typed manifest', async () => {
		const { client } = buildClient({
			'GET https://mock.registry/modules/%40nextvm-community%2Floans/latest': {
				status: 200,
				body: {
					name: '@nextvm-community/loans',
					version: '1.2.0',
					tarballUrl: 'https://cdn.example/loans.tar',
					tarballSha256: 'abc123',
					dependencies: ['banking'],
					premium: false,
				},
			},
		})
		const manifest = await client.getModule('@nextvm-community/loans')
		expect(manifest.version).toBe('1.2.0')
		expect(manifest.dependencies).toEqual(['banking'])
	})

	it('resolveLatest returns the version string', async () => {
		const { client } = buildClient({
			'GET https://mock.registry/modules/foo/latest': {
				status: 200,
				body: {
					name: 'foo',
					version: '2.3.4',
					tarballUrl: 'https://cdn.example/foo.tar',
					tarballSha256: 'sha',
				},
			},
		})
		const v = await client.resolveLatest('foo')
		expect(v).toBe('2.3.4')
	})

	it('downloadTarball verifies the SHA256', async () => {
		const payload = 'tarball-bytes'
		const sha = createHash('sha256').update(payload).digest('hex')
		const { client } = buildClient({
			'GET https://cdn.example/foo.tar': {
				status: 200,
				body: payload,
			},
		})
		const bytes = await client.downloadTarball({
			name: 'foo',
			version: '1.0',
			tarballUrl: 'https://cdn.example/foo.tar',
			tarballSha256: sha,
			dependencies: [],
			premium: false,
		})
		expect(bytes.byteLength).toBeGreaterThan(0)
	})

	it('downloadTarball throws on hash mismatch', async () => {
		const { client } = buildClient({
			'GET https://cdn.example/foo.tar': {
				status: 200,
				body: 'wrong-bytes',
			},
		})
		await expect(
			client.downloadTarball({
				name: 'foo',
				version: '1.0',
				tarballUrl: 'https://cdn.example/foo.tar',
				tarballSha256: 'definitely-not-the-real-hash',
				dependencies: [],
				premium: false,
			}),
		).rejects.toThrow(/integrity check failed/)
	})

	it('publish requires a token', async () => {
		const { client } = buildClient({})
		await expect(
			client.publish(
				{
					name: 'foo',
					version: '1.0',
					tarballUrl: 'x',
					tarballSha256: 'x',
					dependencies: [],
					premium: false,
				},
				new Uint8Array(),
			),
		).rejects.toThrow(/auth token/)
	})

	it('publish posts manifest + tarball when authed', async () => {
		const { client, fetcher } = buildClient(
			{
				'POST https://mock.registry/publish': {
					status: 200,
					body: {
						name: 'foo',
						version: '1.0',
						url: 'https://registry.nextvm.dev/foo/1.0',
					},
				},
			},
			{ token: 'sk_test' },
		)
		const result = await client.publish(
			{
				name: 'foo',
				version: '1.0',
				tarballUrl: 'x',
				tarballSha256: 'x',
				dependencies: [],
				premium: false,
			},
			new Uint8Array([1, 2, 3]),
		)
		expect(result.url).toBe('https://registry.nextvm.dev/foo/1.0')
		expect(fetcher).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer sk_test' }),
			}),
		)
	})

	it('verifyLicense returns the parsed result', async () => {
		const { client } = buildClient({
			'POST https://mock.registry/licenses/verify': {
				status: 200,
				body: { valid: true },
			},
		})
		const result = await client.verifyLicense('foo', 'license-key')
		expect(result.valid).toBe(true)
	})
})
