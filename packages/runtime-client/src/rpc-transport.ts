import type { RpcTransport } from '@nextvm/core'

/**
 * Client-side RPC transport.
 *
 * Concept v2.3, Chapter 10.2:
 *   "The framework's network layer sends typed RPC requests to the
 *    server and routes the response back to the original promise."
 *
 * Wire protocol — paired with @nextvm/runtime-server's bridge:
 *
 *   client → server: emitNet('__nextvm:rpc', namespace, procedure, input, requestId)
 *   server → client: emitNet('__nextvm:rpc:response', requestId, errorMessage|null, result|null)
 *
 * Each outgoing call gets a monotonic numeric `requestId`. The transport
 * keeps a `Map<requestId, { resolve, reject }>` and resolves the
 * matching entry when the response event fires. Unknown ids are dropped.
 *
 * The transport is testable in plain Node by passing your own
 * `emit`/`subscribe` functions instead of the FiveM globals — see
 * the constructor signature.
 */
export interface RpcTransportOptions {
	emit: (event: string, ...args: unknown[]) => void
	subscribe: (event: string, handler: (...args: unknown[]) => void) => void
	timeoutMs?: number
}

interface PendingCall {
	resolve: (value: unknown) => void
	reject: (reason: unknown) => void
	timer: ReturnType<typeof setTimeout> | null
}

export class RuntimeRpcTransport {
	private nextRequestId = 1
	private pending = new Map<number, PendingCall>()
	private readonly emit: RpcTransportOptions['emit']
	private readonly timeoutMs: number

	constructor(opts: RpcTransportOptions) {
		this.emit = opts.emit
		this.timeoutMs = opts.timeoutMs ?? 10_000
		opts.subscribe('__nextvm:rpc:response', (...args: unknown[]) => {
			const [requestId, errorMessage, result] = args as [number, string | null, unknown]
			this.handleResponse(requestId, errorMessage, result)
		})
	}

	/** RpcTransport-compatible call function */
	call: RpcTransport = (namespace, procedure, input) => {
		return new Promise<unknown>((resolve, reject) => {
			const requestId = this.nextRequestId++
			const timer =
				this.timeoutMs > 0
					? setTimeout(() => {
							this.pending.delete(requestId)
							reject(new Error(`RPC ${namespace}.${procedure} timed out after ${this.timeoutMs}ms`))
						}, this.timeoutMs)
					: null
			this.pending.set(requestId, { resolve, reject, timer })
			this.emit('__nextvm:rpc', namespace, procedure, input, requestId)
		})
	}

	/** Number of in-flight calls (test helper) */
	get inFlight(): number {
		return this.pending.size
	}

	private handleResponse(requestId: number, errorMessage: string | null, result: unknown): void {
		const pending = this.pending.get(requestId)
		if (!pending) return
		this.pending.delete(requestId)
		if (pending.timer) clearTimeout(pending.timer)
		if (errorMessage) {
			pending.reject(new Error(errorMessage))
		} else {
			pending.resolve(result)
		}
	}
}
