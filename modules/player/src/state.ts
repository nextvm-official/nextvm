import { defineState, z } from '@nextvm/core'

/**
 * Player state — character-scoped.
 * Stores the runtime state of a player's character: position,
 * health, armor, alive/dead status. Persisted via the StateBagBackend
 * so other modules and clients can read it reactively.
 */
export const playerState = defineState('player', {
	posX: z.number().default(0).describe('Player world X coordinate'),
	posY: z.number().default(0).describe('Player world Y coordinate'),
	posZ: z.number().default(0).describe('Player world Z coordinate'),
	health: z.number().min(0).max(200).default(100).describe('Current health (0-200)'),
	armor: z.number().min(0).max(100).default(0).describe('Current armor (0-100)'),
	isDead: z.boolean().default(false).describe('True if the player is dead'),
})
