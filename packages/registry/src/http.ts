/**
 * Minimal HTTP layer for the registry client.
 * Same shape as @nextvm/tebex/http — defining a small Fetcher
 * interface lets tests inject a mock without globally stubbing fetch.
 */

export interface FetcherRequest {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	url: string
	headers?: Record<string, string>
	body?: string | Uint8Array
}

export interface FetcherResponse {
	status: number
	body: string
}

export type Fetcher = (req: FetcherRequest) => Promise<FetcherResponse>

export const defaultFetcher: Fetcher = async (req) => {
	const fn = (globalThis as { fetch?: typeof fetch }).fetch
	if (!fn) {
		throw new Error(
			'Global fetch is not available — pass a custom Fetcher to RegistryClient.',
		)
	}
	const init: { method: string; headers?: Record<string, string>; body?: unknown } = {
		method: req.method,
		headers: req.headers,
	}
	if (req.body !== undefined) {
		init.body = req.body
	}
	// fetch's init type is structurally compatible — cast for the call.
	const res = await fn(req.url, init as Parameters<typeof fn>[1])
	const body = await res.text()
	return { status: res.status, body }
}
