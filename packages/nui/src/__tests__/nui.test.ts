import { afterEach, describe, expect, it, vi } from 'vitest'
import { NuiBrowser } from '../browser'
import { NuiClient } from '../client'
import { NEXTVM_RESPONSE_CALLBACK, type NuiEnvelope } from '../protocol'

describe('NuiClient.emit', () => {
	it('sends an event envelope to SendNUIMessage', () => {
		const sent: unknown[] = []
		const client = new NuiClient({
			send: (data) => sent.push(data),
			registerCallback: () => undefined,
		})
		client.emit('hud.update', { hp: 80 })
		expect(sent).toEqual([{ kind: 'event', channel: 'hud.update', data: { hp: 80 } }])
	})
})

describe('NuiClient.request', () => {
	it('correlates the response to the original promise', async () => {
		let responseCallback: ((data: unknown, cb: (r: unknown) => void) => void) | null = null
		const sent: NuiEnvelope[] = []
		const client = new NuiClient({
			send: (data) => sent.push(data as NuiEnvelope),
			registerCallback: (name, handler) => {
				if (name === NEXTVM_RESPONSE_CALLBACK) responseCallback = handler
			},
		})
		const promise = client.request('shop.getOffers', { category: 'food' })
		expect(client.inFlight).toBe(1)
		expect(sent).toHaveLength(1)
		const envelope = sent[0]
		expect(envelope?.kind).toBe('request')
		const requestId = envelope?.kind === 'request' ? envelope.requestId : -1

		responseCallback?.(
			{ requestId, error: null, data: [{ id: 1 }] },
			() => undefined,
		)
		await expect(promise).resolves.toEqual([{ id: 1 }])
		expect(client.inFlight).toBe(0)
	})

	it('rejects when the response carries an error', async () => {
		let responseCallback: ((data: unknown, cb: (r: unknown) => void) => void) | null = null
		const client = new NuiClient({
			send: () => undefined,
			registerCallback: (name, handler) => {
				if (name === NEXTVM_RESPONSE_CALLBACK) responseCallback = handler
			},
		})
		const promise = client.request('any')
		responseCallback?.({ requestId: 1, error: 'boom', data: null }, () => undefined)
		await expect(promise).rejects.toThrow(/boom/)
	})

	it('times out when no response arrives', async () => {
		vi.useFakeTimers()
		const client = new NuiClient({
			send: () => undefined,
			registerCallback: () => undefined,
			timeoutMs: 50,
		})
		const promise = client.request('slow')
		vi.advanceTimersByTime(60)
		await expect(promise).rejects.toThrow(/timed out/)
		vi.useRealTimers()
	})
})

describe('NuiClient.on', () => {
	it('registers a callback exactly once and forwards the response', async () => {
		const registered: Record<string, (data: unknown, cb: (r: unknown) => void) => void> = {}
		const client = new NuiClient({
			send: () => undefined,
			registerCallback: (name, handler) => {
				registered[name] = handler
			},
		})
		const handler = vi.fn((data: unknown, respond: (r: unknown) => void) => {
			respond({ ok: true, echo: data })
		})
		client.on('shop.buy', handler)
		const cbResults: unknown[] = []
		registered['shop.buy']?.({ id: 5 }, (r) => cbResults.push(r))
		// Allow microtask flush
		await Promise.resolve()
		expect(handler).toHaveBeenCalled()
		expect(cbResults).toEqual([{ ok: true, echo: { id: 5 } }])
	})

	it('throws on duplicate channel registration', () => {
		const client = new NuiClient({
			send: () => undefined,
			registerCallback: () => undefined,
		})
		client.on('a', () => undefined)
		expect(() => client.on('a', () => undefined)).toThrow(/already registered/)
	})
})

describe('NuiClient.setFocus', () => {
	it('forwards to SetNuiFocus', () => {
		const calls: Array<[boolean, boolean]> = []
		const client = new NuiClient({
			send: () => undefined,
			registerCallback: () => undefined,
			setFocus: (a, b) => calls.push([a, b]),
		})
		client.setFocus(true, true)
		expect(calls).toEqual([[true, true]])
	})
})

// --- NuiBrowser ---

const buildBrowser = () => {
	type Listener = (ev: MessageEvent) => void
	const listeners: Listener[] = []
	const win = {
		addEventListener: (_event: string, handler: Listener) => listeners.push(handler),
		removeEventListener: () => undefined,
	}
	const fetchCalls: Array<[string, RequestInit | undefined]> = []
	let nextResponse: { ok: boolean; status: number; json: () => Promise<unknown> } = {
		ok: true,
		status: 200,
		json: async () => ({ pong: true }),
	}
	const fetchFn: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		fetchCalls.push([String(input), init])
		return nextResponse as unknown as Response
	}) as typeof fetch
	const browser = new NuiBrowser({
		resourceName: 'nextvm-test',
		window: win as unknown as Window,
		fetch: fetchFn,
	})
	const dispatch = (data: unknown) => {
		for (const l of listeners) l({ data } as MessageEvent)
	}
	const setNextResponse = (r: typeof nextResponse) => {
		nextResponse = r
	}
	return { browser, fetchCalls, dispatch, setNextResponse }
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('NuiBrowser.on', () => {
	it('receives events of the matching channel', async () => {
		const { browser, dispatch } = buildBrowser()
		const seen: unknown[] = []
		browser.on('hud.update', (data) => {
			seen.push(data)
		})
		dispatch({ kind: 'event', channel: 'hud.update', data: { hp: 50 } })
		await Promise.resolve()
		expect(seen).toEqual([{ hp: 50 }])
	})

	it('ignores events for other channels', async () => {
		const { browser, dispatch } = buildBrowser()
		const seen: unknown[] = []
		browser.on('hud.update', (d) => seen.push(d))
		dispatch({ kind: 'event', channel: 'other', data: 1 })
		await Promise.resolve()
		expect(seen).toEqual([])
	})

	it('subscribe + unsubscribe', () => {
		const { browser } = buildBrowser()
		const off = browser.on('a', () => undefined)
		expect(browser.subscriberCount('a')).toBe(1)
		off()
		expect(browser.subscriberCount('a')).toBe(0)
	})
})

describe('NuiBrowser.call', () => {
	it('POSTs JSON to https://<resource>/<channel>', async () => {
		const { browser, fetchCalls } = buildBrowser()
		const result = await browser.call('shop.buy', { id: 5 })
		expect(result).toEqual({ pong: true })
		expect(fetchCalls).toHaveLength(1)
		expect(fetchCalls[0][0]).toBe('https://nextvm-test/shop.buy')
		expect(fetchCalls[0][1]?.method).toBe('POST')
		expect(JSON.parse(String(fetchCalls[0][1]?.body))).toEqual({ id: 5 })
	})

	it('throws on non-2xx response', async () => {
		const { browser, setNextResponse } = buildBrowser()
		setNextResponse({ ok: false, status: 500, json: async () => ({}) })
		await expect(browser.call('a')).rejects.toThrow(/HTTP 500/)
	})
})

describe('NuiBrowser request envelope handling', () => {
	it('runs the matching handler and posts the response back', async () => {
		const { browser, fetchCalls, dispatch } = buildBrowser()
		browser.on('shop.getOffers', async (data) => {
			return { received: data }
		})
		dispatch({ kind: 'request', requestId: 7, channel: 'shop.getOffers', data: { tag: 'a' } })
		// Yield twice — once for handler, once for fetch
		await Promise.resolve()
		await Promise.resolve()
		expect(fetchCalls).toHaveLength(1)
		expect(fetchCalls[0][0]).toBe(`https://nextvm-test/${NEXTVM_RESPONSE_CALLBACK}`)
		const body = JSON.parse(String(fetchCalls[0][1]?.body))
		expect(body).toEqual({ requestId: 7, error: null, data: { received: { tag: 'a' } } })
	})

	it('returns an error when no handler is registered', async () => {
		const { fetchCalls, dispatch } = buildBrowser()
		dispatch({ kind: 'request', requestId: 8, channel: 'unknown', data: null })
		await Promise.resolve()
		await Promise.resolve()
		const body = JSON.parse(String(fetchCalls[0][1]?.body))
		expect(body.error).toMatch(/No handler/)
	})

	it('reports thrown handler errors', async () => {
		const { browser, fetchCalls, dispatch } = buildBrowser()
		browser.on('boom', () => {
			throw new Error('nope')
		})
		dispatch({ kind: 'request', requestId: 9, channel: 'boom', data: null })
		await Promise.resolve()
		await Promise.resolve()
		const body = JSON.parse(String(fetchCalls[0][1]?.body))
		expect(body.error).toMatch(/nope/)
	})
})
