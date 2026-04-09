/**
 * NuiClient — runs inside the FiveM client runtime.
 * Wraps `SendNUIMessage`, `RegisterNUICallback`, and `SetNuiFocus`
 * behind a typed channel-based API. Pairs with `NuiBrowser` from
 * `@nextvm/nui/browser` over the wire protocol in `./protocol`.
 */

import {
	NEXTVM_RESPONSE_CALLBACK,
	type NuiEnvelope,
	type NuiResponseBody,
} from './protocol'

declare function SendNUIMessage(data: unknown): void
declare function RegisterNUICallback(
	name: string,
	handler: (data: unknown, cb: (response: unknown) => void) => void,
): void
declare function SetNuiFocus(hasFocus: boolean, hasCursor: boolean): void
declare function GetCurrentResourceName(): string

export type NuiCallbackHandler = (
	data: unknown,
	respond: (response: unknown) => void,
) => void | Promise<void>

export interface NuiClientOptions {
	/** Override SendNUIMessage (test injection) */
	send?: (data: unknown) => void
	/** Override RegisterNUICallback (test injection) */
	registerCallback?: (
		name: string,
		handler: (data: unknown, cb: (response: unknown) => void) => void,
	) => void
	/** Override SetNuiFocus (test injection) */
	setFocus?: (hasFocus: boolean, hasCursor: boolean) => void
	/** Default request timeout in ms (default 10s) */
	timeoutMs?: number
}

interface PendingRequest {
	resolve: (value: unknown) => void
	reject: (reason: unknown) => void
	timer: ReturnType<typeof setTimeout> | null
}

export class NuiClient {
	private readonly send: (data: unknown) => void
	private readonly registerCallback: NonNullable<NuiClientOptions['registerCallback']>
	private readonly setFocusFn: (hasFocus: boolean, hasCursor: boolean) => void
	private readonly timeoutMs: number
	private nextRequestId = 1
	private pending = new Map<number, PendingRequest>()
	private callbacks = new Map<string, NuiCallbackHandler>()

	constructor(opts: NuiClientOptions = {}) {
		this.send = opts.send ?? (typeof SendNUIMessage === 'function' ? SendNUIMessage : () => undefined)
		this.registerCallback =
			opts.registerCallback ??
			(typeof RegisterNUICallback === 'function' ? RegisterNUICallback : () => undefined)
		this.setFocusFn =
			opts.setFocus ??
			(typeof SetNuiFocus === 'function' ? SetNuiFocus : () => undefined)
		this.timeoutMs = opts.timeoutMs ?? 10_000

		// Always register the response callback so NUI can correlate
		// client-initiated requests back to their pending promises.
		this.registerCallback(NEXTVM_RESPONSE_CALLBACK, (data, cb) => {
			const body = data as NuiResponseBody
			this.handleResponse(body)
			cb({ ok: true })
		})
	}

	/** Fire a one-way message to the NUI frame */
	emit(channel: string, data?: unknown): void {
		const envelope: NuiEnvelope = { kind: 'event', channel, data }
		this.send(envelope)
	}

	/** Send a request to the NUI frame and wait for its response */
	request(channel: string, data?: unknown): Promise<unknown> {
		return new Promise<unknown>((resolve, reject) => {
			const requestId = this.nextRequestId++
			const timer =
				this.timeoutMs > 0
					? setTimeout(() => {
							this.pending.delete(requestId)
							reject(new Error(`NUI request '${channel}' timed out after ${this.timeoutMs}ms`))
						}, this.timeoutMs)
					: null
			this.pending.set(requestId, { resolve, reject, timer })
			const envelope: NuiEnvelope = { kind: 'request', requestId, channel, data }
			this.send(envelope)
		})
	}

	/**
	 * Register a handler for a NUI → client callback. The NUI side calls
	 * `nuiCall(channel, data)` (or a raw `fetch`); the handler receives
	 * the data and a `respond()` function whose return value is sent
	 * back as the fetch response body.
	 */
	on(channel: string, handler: NuiCallbackHandler): void {
		if (this.callbacks.has(channel)) {
			throw new Error(`NUI callback '${channel}' is already registered`)
		}
		this.callbacks.set(channel, handler)
		this.registerCallback(channel, (data, cb) => {
			void Promise.resolve(handler(data, cb))
		})
	}

	/** Toggle the NUI focus + cursor */
	setFocus(hasFocus: boolean, hasCursor: boolean): void {
		this.setFocusFn(hasFocus, hasCursor)
	}

	/** Number of in-flight requests (test helper) */
	get inFlight(): number {
		return this.pending.size
	}

	private handleResponse(body: NuiResponseBody): void {
		const pending = this.pending.get(body.requestId)
		if (!pending) return
		this.pending.delete(body.requestId)
		if (pending.timer) clearTimeout(pending.timer)
		if (body.error) {
			pending.reject(new Error(body.error))
		} else {
			pending.resolve(body.data)
		}
	}
}
