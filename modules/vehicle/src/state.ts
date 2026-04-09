import { defineState, z } from '@nextvm/core'

/**
 * Vehicle state — character-scoped.
 * Tracks the list of network IDs of vehicles owned by a character.
 * The actual vehicle entities live in the game world; this is the
 * authoritative ownership ledger.
 */
export const vehicleState = defineState('vehicle', {
	ownedNetIds: z
		.array(z.number())
		.default([])
		.describe('Network IDs of vehicles owned by this character'),
})
