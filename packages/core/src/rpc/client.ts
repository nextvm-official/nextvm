import type { ClientRouter, Router } from './types'

/**
 * Client-side RPC proxy builder.
 *
 * Concept v2.3, Chapter 10.2:
 *   const balance = await nextvm.rpc.banking.getBalance({ accountId: '123' })
 *
 * The transport function is provided by the framework's network layer
 * (which calls the server-side RpcRouter.dispatch). This module only
 * provides the typed proxy facade.
 */

/** Transport function — sends an RPC call to the server */
export type RpcTransport = (
	namespace: string,
	procedure: string,
	input: unknown,
) => Promise<unknown>

/**
 * Create a typed client-side proxy for a router.
 *
 * Usage on the client:
 *   const banking = createClient<typeof bankingRouter>('banking', transport)
 *   const balance = await banking.getBalance({ accountId: '123' })
 */
export function createClient<TRouter extends Router>(
	namespace: string,
	transport: RpcTransport,
): ClientRouter<TRouter> {
	return new Proxy({} as ClientRouter<TRouter>, {
		get(_target, procedureName: string) {
			return (input: unknown) => transport(namespace, procedureName, input)
		},
	})
}
