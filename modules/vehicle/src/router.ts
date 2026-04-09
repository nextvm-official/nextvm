import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import { NextVMVehicle } from '@nextvm/natives'
import { vehicleState } from './state'

/**
 * Vehicle RPC router.
 * Server-authoritative spawn/despawn.
 * Inputs Zod-validated.
 */
export const vehicleRouter = defineRouter({
	/** Spawn a vehicle for the calling player */
	spawn: procedure
		.input(
			z.object({
				modelHash: z.number().int(),
				x: z.number(),
				y: z.number(),
				z: z.number(),
				heading: z.number().default(0),
			}),
		)
		.mutation(({ input, ctx }) => {
			if (!ctx.charId) {
				throw new RpcError('NOT_FOUND', 'No active character')
			}
			const vehicle = NextVMVehicle.spawn(
				input.modelHash,
				{ x: input.x, y: input.y, z: input.z },
				input.heading,
			)
			const netId = vehicle.getNetworkId()
			const owned = vehicleState.get(ctx.charId, 'ownedNetIds')
			vehicleState.set(ctx.charId, 'ownedNetIds', [...owned, netId])
			return { netId }
		}),

	/** Despawn a vehicle owned by the calling player */
	despawn: procedure
		.input(z.object({ netId: z.number().int() }))
		.mutation(({ input, ctx }) => {
			if (!ctx.charId) {
				throw new RpcError('NOT_FOUND', 'No active character')
			}
			const owned = vehicleState.get(ctx.charId, 'ownedNetIds')
			if (!owned.includes(input.netId)) {
				throw new RpcError('AUTH_ERROR', 'You do not own this vehicle')
			}
			vehicleState.set(
				ctx.charId,
				'ownedNetIds',
				owned.filter((id) => id !== input.netId),
			)
			return { ok: true }
		}),

	/** Repair a vehicle by network ID */
	repair: procedure
		.input(z.object({ netId: z.number().int() }))
		.mutation(({ input, ctx }) => {
			if (!ctx.charId) {
				throw new RpcError('NOT_FOUND', 'No active character')
			}
			const owned = vehicleState.get(ctx.charId, 'ownedNetIds')
			if (!owned.includes(input.netId)) {
				throw new RpcError('AUTH_ERROR', 'You do not own this vehicle')
			}
			// Note: actual repair happens on the entity. The handle resolution
			// from network ID to entity handle is a server primitive that the
			// natives layer will provide once entity-by-netid lookup is exposed.
			return { ok: true }
		}),

	/** Get the calling player's owned vehicle network IDs */
	getMyVehicles: procedure.query(({ ctx }) => {
		if (!ctx.charId) return { netIds: [] as number[] }
		return { netIds: vehicleState.get(ctx.charId, 'ownedNetIds') }
	}),
})
