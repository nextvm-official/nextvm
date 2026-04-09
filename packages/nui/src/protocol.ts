/**
 * Wire protocol shared by `NuiClient` and `NuiBrowser`.
 *   1. Fire-and-forget messages from client → NUI:
 *        client → NUI:  { kind: 'event', channel, data }
 *   2. Request/response from NUI → client:
 *        NUI → client:  fetch('https://<resource>/<channel>', { body })
 *        client → NUI:  resolves the original fetch (FiveM handles this
 *                       via the `cb()` callback in RegisterNUICallback)
 *   3. Request/response from client → NUI (correlated):
 *        client → NUI:  { kind: 'request', requestId, channel, data }
 *        NUI → client:  fetch('https://<resource>/__nextvm_response',
 *                              { body: { requestId, error, data } })
 * The protocol is intentionally tiny — every NextVM-specific extension
 * lives on top of `channel` strings, not in new envelope shapes.
 */

export type NuiEnvelope =
	| { kind: 'event'; channel: string; data: unknown }
	| { kind: 'request'; requestId: number; channel: string; data: unknown }

export interface NuiResponseBody {
	requestId: number
	error: string | null
	data: unknown
}

/** Reserved callback name used for request/response correlation */
export const NEXTVM_RESPONSE_CALLBACK = '__nextvm_response'
