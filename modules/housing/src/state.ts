import { defineState, z } from '@nextvm/core'

/**
 * Housing state — keyed by charId.
 * `ownedPropertyIds` is the authoritative ledger of which properties
 * a character owns. The PropertyRegistry resolves them to definitions.
 */
export const housingState = defineState('housing', {
	ownedPropertyIds: z
		.array(z.string())
		.default([])
		.describe('IDs of properties this character currently owns'),
	currentInstanceId: z
		.string()
		.nullable()
		.default(null)
		.describe('Routing instance the character is currently inside (or null)'),
})
