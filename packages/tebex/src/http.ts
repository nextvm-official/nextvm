/**
 * Minimal HTTP layer for the Tebex client.
 * Defining a small Fetcher interface lets tests inject a mock without
 * mocking the global fetch — and lets advanced users plug their own
 * retry / circuit-breaker / metrics logic in front of the real call.
 */

export interface FetcherRequest {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	url: string
	headers?: Record<string, string>
	body?: string
}

export interface FetcherResponse {
	status: number
	body: string
}

export type Fetcher = (req: FetcherRequest) => Promise<FetcherResponse>

/**
 * Default fetcher backed by the global `fetch` (Node 18+ / FiveM Node 22).
 * Lazily resolves the global so tests in a non-fetch environment can
 * supply a mock without the import-time access blowing up.
 */
export const defaultFetcher: Fetcher = async (req) => {
	const fn = (globalThis as { fetch?: typeof fetch }).fetch
	if (!fn) {
		throw new Error(
			'Global fetch is not available — pass a custom Fetcher to TebexClient.',
		)
	}
	const res = await fn(req.url, {
		method: req.method,
		headers: req.headers,
		body: req.body,
	})
	const body = await res.text()
	return { status: res.status, body }
}
