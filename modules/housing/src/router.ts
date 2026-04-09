import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { HousingService } from './service'

export function buildHousingRouter(service: HousingService) {
	return defineRouter({
		/** All properties owned by the calling character */
		getMyProperties: procedure.query(({ ctx }) => {
			if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
			return service.getOwned(ctx.charId)
		}),

		/** All registered properties */
		listProperties: procedure.query(() => service.getRegistry().all()),

		/** Find properties near a coordinate (e.g. for the marker overlay) */
		getNearbyProperties: procedure
			.input(
				z.object({
					x: z.number(),
					y: z.number(),
					z: z.number(),
					radius: z.number().positive().max(500).default(50),
				}),
			)
			.query(({ input }) => {
				return service
					.getRegistry()
					.findNearby({ x: input.x, y: input.y, z: input.z }, input.radius)
			}),

		/** Buy a property using the calling character's bank balance */
		purchase: procedure
			.input(z.object({ propertyId: z.string() }))
			.mutation(async ({ input, ctx }) => {
				if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
				try {
					const prop = await service.purchase(ctx.charId, input.propertyId)
					return { ok: true, property: prop }
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					if (msg === 'INSUFFICIENT_FUNDS') {
						throw new RpcError('VALIDATION_ERROR', 'Insufficient funds')
					}
					if (msg === 'UNKNOWN_PROPERTY' || msg === 'ALREADY_OWNED') {
						throw new RpcError('VALIDATION_ERROR', msg)
					}
					throw new RpcError('INTERNAL_ERROR', msg)
				}
			}),

		/** Enter the property interior (routing instance) */
		enterProperty: procedure
			.input(z.object({ propertyId: z.string() }))
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
				try {
					return service.enter(ctx.charId, ctx.source, input.propertyId)
				} catch (err) {
					throw new RpcError(
						'VALIDATION_ERROR',
						err instanceof Error ? err.message : String(err),
					)
				}
			}),

		/** Leave the current property and return to the main world */
		leaveProperty: procedure.mutation(({ ctx }) => {
			if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
			service.leave(ctx.charId, ctx.source)
			return { ok: true }
		}),
	})
}
