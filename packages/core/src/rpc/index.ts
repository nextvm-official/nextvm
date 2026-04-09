/**
 * @nextvm/core/rpc — Typed Client-Server RPC
 *
 * Concept v2.3, Chapter 10.
 *
 * Usage (server):
 *   import { defineRouter, procedure, z } from '@nextvm/core'
 *
 *   export const bankingRouter = defineRouter({
 *     getBalance: procedure
 *       .input(z.object({ accountId: z.string() }))
 *       .query(async ({ input, ctx }) => {
 *         return getBalanceFromDb(input.accountId)
 *       }),
 *
 *     transfer: procedure
 *       .input(z.object({ from: z.string(), to: z.string(), amount: z.number().positive() }))
 *       .auth((ctx) => permissions.hasPermission(ctx.source, 'banking.transfer'))
 *       .mutation(async ({ input, ctx }) => { ... }),
 *   })
 *
 * Usage (client):
 *   const balance = await nextvm.rpc.banking.getBalance({ accountId: '123' })
 */

export { defineRouter } from './define-router'
export { procedure } from './procedure'
export { RpcRouter } from './router'
export type { RpcErrorReporter } from './router'
export { RateLimiter } from './rate-limiter'
export { createClient } from './client'
export { RpcError } from './types'
export type {
	Router,
	ClientRouter,
	ProcedureDefinition,
	ProcedureType,
	RpcContext,
	RpcErrorCode,
	RpcEncryptionAdapter,
	AuthMiddleware,
	InferInput,
	InferOutput,
} from './types'
export type { RpcTransport } from './client'
