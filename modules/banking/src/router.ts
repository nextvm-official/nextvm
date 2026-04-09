import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { BankingService } from './service'

/**
 * Build the banking router with the BankingService captured in the
 * closure. The router is a factory because it needs the service
 * instance from the module context (Concept Chapter 10).
 */
export function buildBankingRouter(service: BankingService) {
	return defineRouter({
		/** Get the calling player's balance */
		getMyBalance: procedure.query(({ ctx }) => {
			if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
			return service.get(ctx.charId)
		}),

		/** Admin: get any character's balance */
		getBalance: procedure
			.input(z.object({ charId: z.number().int().positive() }))
			.query(({ input }) => service.get(input.charId)),

		/** Transfer money to another character */
		transfer: procedure
			.input(
				z.object({
					toCharId: z.number().int().positive(),
					type: z.enum(['cash', 'bank']),
					amount: z.number().int().positive(),
					reason: z.string().max(255).optional(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
				try {
					return await service.transfer(
						ctx.charId,
						input.toCharId,
						input.type,
						input.amount,
						input.reason,
					)
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					if (msg === 'INSUFFICIENT_FUNDS') {
						throw new RpcError('VALIDATION_ERROR', 'Insufficient funds')
					}
					throw new RpcError('INTERNAL_ERROR', msg)
				}
			}),

		/** Admin: credit money to a character */
		addMoney: procedure
			.input(
				z.object({
					charId: z.number().int().positive(),
					type: z.enum(['cash', 'bank']),
					amount: z.number().int().positive(),
					reason: z.string().max(255).optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const balance = await service.addMoney(
					input.charId,
					input.type,
					input.amount,
					input.reason,
				)
				return { ok: true, balance }
			}),

		/** Admin: debit money from a character */
		removeMoney: procedure
			.input(
				z.object({
					charId: z.number().int().positive(),
					type: z.enum(['cash', 'bank']),
					amount: z.number().int().positive(),
					reason: z.string().max(255).optional(),
				}),
			)
			.mutation(async ({ input }) => {
				try {
					const balance = await service.removeMoney(
						input.charId,
						input.type,
						input.amount,
						input.reason,
					)
					return { ok: true, balance }
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					if (msg === 'INSUFFICIENT_FUNDS') {
						throw new RpcError('VALIDATION_ERROR', 'Insufficient funds')
					}
					throw new RpcError('INTERNAL_ERROR', msg)
				}
			}),
	})
}
