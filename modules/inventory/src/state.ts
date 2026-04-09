import { defineState, z } from '@nextvm/core'

/**
 * A single inventory slot.
 * Empty slots are represented by `null`.
 */
const slotSchema = z.object({
	itemId: z.string(),
	count: z.number().int().positive(),
})

/**
 * Inventory state — character-scoped (GUARD-011).
 *
 * Slots are stored as an array of (slot, item) tuples to keep the
 * shape JSON-serializable for state bag persistence and DB storage.
 */
export const inventoryState = defineState('inventory', {
	slots: z
		.array(
			z.object({
				slot: z.number().int().min(0),
				stack: slotSchema,
			}),
		)
		.default([])
		.describe('Slot-keyed item stacks owned by this character'),
})

export type InventorySlot = z.infer<typeof slotSchema>
