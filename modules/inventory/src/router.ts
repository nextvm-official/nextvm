import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { ItemRegistry } from './items'
import { inventoryState, type InventorySlot } from './state'

interface SlotEntry {
	slot: number
	stack: InventorySlot
}

/**
 * Build the inventory router.
 * The router is a factory because it needs the ItemRegistry instance
 * (which lives on the module's server context) to validate item ids.
 */
export function buildInventoryRouter(registry: ItemRegistry, maxSlots: number, maxWeightKg: number) {
	const readSlots = (charId: number): SlotEntry[] =>
		inventoryState.get(charId, 'slots') as SlotEntry[]
	const writeSlots = (charId: number, slots: SlotEntry[]): void => {
		inventoryState.set(charId, 'slots', slots)
	}
	const totalWeight = (slots: SlotEntry[]): number => {
		let w = 0
		for (const entry of slots) {
			const def = registry.get(entry.stack.itemId)
			if (def) w += def.weight * entry.stack.count
		}
		return w
	}

	return defineRouter({
		/** Get the calling player's full inventory */
		getMyInventory: procedure.query(({ ctx }) => {
			if (!ctx.charId) return { slots: [] }
			return { slots: readSlots(ctx.charId) }
		}),

		/** Use an item from a specific slot. Decrements the stack. */
		useItem: procedure
			.input(z.object({ slot: z.number().int().min(0) }))
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) {
					throw new RpcError('NOT_FOUND', 'No active character')
				}
				const slots = readSlots(ctx.charId)
				const idx = slots.findIndex((s) => s.slot === input.slot)
				if (idx === -1) {
					throw new RpcError('NOT_FOUND', 'Slot is empty')
				}
				const entry = slots[idx]!
				const def = registry.get(entry.stack.itemId)
				if (!def) {
					throw new RpcError('VALIDATION_ERROR', 'Unknown item id')
				}
				const remaining = entry.stack.count - 1
				if (remaining <= 0) {
					slots.splice(idx, 1)
				} else {
					slots[idx] = { ...entry, stack: { ...entry.stack, count: remaining } }
				}
				writeSlots(ctx.charId, slots)
				return { ok: true, used: def.id }
			}),

		/** Drop a count of items from a slot (removes them from inventory) */
		dropItem: procedure
			.input(
				z.object({
					slot: z.number().int().min(0),
					count: z.number().int().positive(),
				}),
			)
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) {
					throw new RpcError('NOT_FOUND', 'No active character')
				}
				const slots = readSlots(ctx.charId)
				const idx = slots.findIndex((s) => s.slot === input.slot)
				if (idx === -1) {
					throw new RpcError('NOT_FOUND', 'Slot is empty')
				}
				const entry = slots[idx]!
				if (entry.stack.count < input.count) {
					throw new RpcError('VALIDATION_ERROR', 'Not enough items in slot')
				}
				const remaining = entry.stack.count - input.count
				if (remaining <= 0) {
					slots.splice(idx, 1)
				} else {
					slots[idx] = { ...entry, stack: { ...entry.stack, count: remaining } }
				}
				writeSlots(ctx.charId, slots)
				return { ok: true, dropped: input.count }
			}),

		/** Move a stack from one slot to another */
		moveItem: procedure
			.input(
				z.object({
					fromSlot: z.number().int().min(0),
					toSlot: z.number().int().min(0),
				}),
			)
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) {
					throw new RpcError('NOT_FOUND', 'No active character')
				}
				if (input.toSlot >= maxSlots) {
					throw new RpcError('VALIDATION_ERROR', `Target slot exceeds max ${maxSlots}`)
				}
				const slots = readSlots(ctx.charId)
				const fromIdx = slots.findIndex((s) => s.slot === input.fromSlot)
				if (fromIdx === -1) {
					throw new RpcError('NOT_FOUND', 'Source slot empty')
				}
				const fromEntry = slots[fromIdx]!
				const toIdx = slots.findIndex((s) => s.slot === input.toSlot)
				if (toIdx === -1) {
					slots[fromIdx] = { ...fromEntry, slot: input.toSlot }
				} else {
					// Swap
					const toEntry = slots[toIdx]!
					slots[fromIdx] = { ...toEntry, slot: input.fromSlot }
					slots[toIdx] = { ...fromEntry, slot: input.toSlot }
				}
				writeSlots(ctx.charId, slots)
				return { ok: true }
			}),

		/** Server-only helper: add an item to the inventory */
		addItem: procedure
			.input(
				z.object({
					itemId: z.string(),
					count: z.number().int().positive(),
				}),
			)
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) {
					throw new RpcError('NOT_FOUND', 'No active character')
				}
				const def = registry.get(input.itemId)
				if (!def) {
					throw new RpcError('VALIDATION_ERROR', 'Unknown item id')
				}

				const slots = readSlots(ctx.charId)
				const projectedWeight =
					totalWeight(slots) + def.weight * input.count
				if (projectedWeight > maxWeightKg) {
					throw new RpcError('VALIDATION_ERROR', 'Inventory weight limit exceeded')
				}

				let remaining = input.count
				if (def.stackable) {
					for (const entry of slots) {
						if (entry.stack.itemId !== input.itemId) continue
						const room = def.maxStack - entry.stack.count
						if (room <= 0) continue
						const add = Math.min(room, remaining)
						entry.stack.count += add
						remaining -= add
						if (remaining === 0) break
					}
				}

				while (remaining > 0) {
					const usedSlots = new Set(slots.map((s) => s.slot))
					let freeSlot = -1
					for (let i = 0; i < maxSlots; i++) {
						if (!usedSlots.has(i)) {
							freeSlot = i
							break
						}
					}
					if (freeSlot === -1) {
						throw new RpcError('VALIDATION_ERROR', 'Inventory full')
					}
					const stackSize = def.stackable ? Math.min(def.maxStack, remaining) : 1
					slots.push({
						slot: freeSlot,
						stack: { itemId: input.itemId, count: stackSize },
					})
					remaining -= stackSize
				}

				writeSlots(ctx.charId, slots)
				return { ok: true, added: input.count }
			}),
	})
}
