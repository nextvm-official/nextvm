import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import { playerState } from './state'

/**
 * Player RPC router.
 *
 * Concept v2.3, Chapter 10.
 *
 * All write operations are server-authoritative (GUARD-003).
 * Admin operations are gated by the .auth() middleware (GUARD permissions).
 */
export const playerRouter = defineRouter({
	/** Get the calling player's full state */
	getMe: procedure.query(({ ctx }) => {
		if (!ctx.charId) {
			throw new RpcError('NOT_FOUND', 'No active character')
		}
		return playerState.getAll(ctx.charId)
	}),

	/** Get another player's state by charId */
	getPlayer: procedure
		.input(z.object({ charId: z.number().int().positive() }))
		.query(({ input }) => playerState.getAll(input.charId)),

	/** Teleport the calling player */
	teleport: procedure
		.input(
			z.object({
				x: z.number(),
				y: z.number(),
				z: z.number(),
			}),
		)
		.mutation(({ input, ctx }) => {
			if (!ctx.charId) {
				throw new RpcError('NOT_FOUND', 'No active character')
			}
			playerState.set(ctx.charId, 'posX', input.x)
			playerState.set(ctx.charId, 'posY', input.y)
			playerState.set(ctx.charId, 'posZ', input.z)
			return { ok: true }
		}),

	/** Admin: revive a target character */
	revive: procedure
		.input(z.object({ charId: z.number().int().positive() }))
		.mutation(({ input }) => {
			playerState.set(input.charId, 'isDead', false)
			playerState.set(input.charId, 'health', 100)
			return { ok: true }
		}),

	/** Admin: set a target character's health */
	setHealth: procedure
		.input(
			z.object({
				charId: z.number().int().positive(),
				health: z.number().min(0).max(200),
			}),
		)
		.mutation(({ input }) => {
			playerState.set(input.charId, 'health', input.health)
			return { ok: true }
		}),
})
