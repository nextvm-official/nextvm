/**
 * NuiBrowser — runs inside the NUI browser frame (the React/Vite app).
 *
 * Listens for `window.message` events from the FiveM client and exposes
 * the typed channel API to NUI code. Outbound calls use `fetch` against
 * `https://<resource>/<channel>` — the FiveM RegisterNUICallback handler
 * on the client side wakes up and resolves the fetch with whatever
 * `respond()` was called with.
 *
 * Concept v2.3, Chapter 19.
 */

import {
	NEXTVM_RESPONSE_CALLBACK,
	type NuiEnvelope,
	type NuiResponseBody,
} from './protocol'

export interface NuiBrowserOptions {
	/** Resource name — used to build fetch URLs */
	resourceName: string
	/** Override `window` (test injection) */
	window?: Pick<Window, 'addEventListener' | 'removeEventListener'>
	/** Override `fetch` (test injection) */
	fetch?: typeof fetch
}

export type NuiBrowserHandler = (data: unknown) => void | Promise<unknown>

export class NuiBrowser {
	private readonly resource: string
	private readonly fetchFn: typeof fetch
	private readonly subscribers = new Map<string, Set<NuiBrowserHandler>>()
	private readonly messageListener: (ev: MessageEvent) => void

	constructor(opts: NuiBrowserOptions) {
		this.resource = opts.resourceName
		this.fetchFn = opts.fetch ?? (typeof fetch === 'function' ? fetch : (() => {
			throw new Error('NuiBrowser: no fetch available')
		}))
		const win = opts.window ?? (typeof window !== 'undefined' ? window : null)
		if (!win) {
			throw new Error('NuiBrowser: no window available — did you load this in a browser context?')
		}
		this.messageListener = (ev) => this.handleMessage(ev.data as NuiEnvelope)
		win.addEventListener('message', this.messageListener as EventListener)
	}

	/** Subscribe to a channel pushed from the client runtime */
	on(channel: string, handler: NuiBrowserHandler): () => void {
		let set = this.subscribers.get(channel)
		if (!set) {
			set = new Set()
			this.subscribers.set(channel, set)
		}
		set.add(handler)
		return () => set?.delete(handler)
	}

	/** Call a NUI callback registered on the client (request/response) */
	async call(channel: string, data?: unknown): Promise<unknown> {
		const url = `https://${this.resource}/${channel}`
		const response = await this.fetchFn(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data ?? {}),
		})
		if (!response.ok) {
			throw new Error(`NUI call '${channel}' failed: HTTP ${response.status}`)
		}
		return response.json()
	}

	/** Number of registered subscribers (test helper) */
	subscriberCount(channel: string): number {
		return this.subscribers.get(channel)?.size ?? 0
	}

	private async handleMessage(envelope: NuiEnvelope | null | undefined): Promise<void> {
		if (!envelope || typeof envelope !== 'object' || !('kind' in envelope)) return
		if (envelope.kind === 'event') {
			const handlers = this.subscribers.get(envelope.channel)
			if (!handlers) return
			for (const handler of handlers) {
				try {
					await handler(envelope.data)
				} catch {
					// Subscriber threw — swallow so one bad handler doesn't kill the bus
				}
			}
			return
		}
		if (envelope.kind === 'request') {
			const handlers = this.subscribers.get(envelope.channel)
			let result: unknown = null
			let errorMessage: string | null = null
			if (!handlers || handlers.size === 0) {
				errorMessage = `No handler for NUI channel '${envelope.channel}'`
			} else {
				try {
					// Only one response per request, so use the first handler.
					const [handler] = handlers
					result = handler ? await handler(envelope.data) : null
				} catch (err) {
					errorMessage = err instanceof Error ? err.message : String(err)
				}
			}
			const body: NuiResponseBody = {
				requestId: envelope.requestId,
				error: errorMessage,
				data: result,
			}
			await this.fetchFn(`https://${this.resource}/${NEXTVM_RESPONSE_CALLBACK}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			}).catch(() => undefined)
		}
	}
}
