import type { Router } from './types'

/**
 * Define an RPC router — a collection of named procedures.
 *   export const bankingRouter = defineRouter({
 *     getBalance: procedure.input(...).query(...),
 *     transfer: procedure.input(...).mutation(...),
 *   })
 * The router preserves all procedure types, enabling fully typed
 * client calls via `nextvm.rpc.banking.getBalance(...)`.
 */
export function defineRouter<TRouter extends Router>(router: TRouter): TRouter {
	return router
}
