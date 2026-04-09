/**
 * @nextvm/inventory — First-party inventory module
 *
 * Concept v2.3, Chapter 8 + 18.
 *
 * Slot-based inventory with weight and stacking rules. The item
 * registry is module-scoped and populated at module init time.
 *
 * - GUARD-002: depends on 'player' via DI
 * - GUARD-003: server-authoritative add/use/move/drop
 * - GUARD-005: Zod-validated RPC inputs + state schema
 * - GUARD-006: ItemRegistry is instance state, not global
 * - GUARD-011: state keyed by charId
 * - GUARD-012: i18n strings
 *
 * PLA: This module manages in-game items but does NOT process payments.
 * Modules built on top that sell items to players must integrate via
 * @nextvm/tebex (GUARD-013) and ship a MONETIZATION.md.
 */

import { defineModule, z } from '@nextvm/core'
import { ItemRegistry } from './items'
import { buildInventoryRouter } from './router'
import { inventoryState } from './state'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'

export default defineModule({
	name: 'inventory',
	version: '0.1.0',
	dependencies: ['player'],

	config: z.object({
		maxSlots: z
			.number()
			.int()
			.min(1)
			.max(200)
			.default(40)
			.describe('Maximum number of inventory slots per character'),
		maxWeightKg: z
			.number()
			.min(1)
			.max(500)
			.default(50)
			.describe('Maximum carry weight per character in kilograms'),
	}),

	server: (ctx) => {
		const config = ctx.config as { maxSlots: number; maxWeightKg: number }
		const registry = new ItemRegistry()

		// Seed a couple of default items so the module is usable out of the box.
		registry.define({
			id: 'water_bottle',
			labelKey: 'inventory.items.water_bottle',
			weight: 0.5,
			stackable: true,
			maxStack: 10,
			category: 'consumable',
		})
		registry.define({
			id: 'bread',
			labelKey: 'inventory.items.bread',
			weight: 0.3,
			stackable: true,
			maxStack: 10,
			category: 'consumable',
		})
		registry.define({
			id: 'phone',
			labelKey: 'inventory.items.phone',
			weight: 0.2,
			stackable: false,
			maxStack: 1,
			category: 'tool',
		})

		// Build the router with the registry + config in scope.
		// The router is exposed via the module's shared.constants below so
		// other modules can derive client types via inject('inventory').
		const router = buildInventoryRouter(registry, config.maxSlots, config.maxWeightKg)
		ctx.exposeRouter(router)

		ctx.log.info('inventory module loaded (server)', {
			items: registry.all().length,
			maxSlots: config.maxSlots,
			maxWeightKg: config.maxWeightKg,
			procedures: Object.keys(router).length,
		})

		ctx.onPlayerReady(async (player) => {
			const charId = player.character.id
			// Ensure the slot list exists for this character
			const current = inventoryState.get(charId, 'slots')
			if (!current) inventoryState.set(charId, 'slots', [])
		})

		ctx.onPlayerDropped(async (player) => {
			inventoryState.clear(player.character.id)
		})
	},

	client: (ctx) => {
		ctx.log.info('inventory module loaded (client)')
	},

	shared: {
		schemas: { state: inventoryState },
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

export { ItemRegistry, defineItem } from './items'
export type { ItemDefinition } from './items'
export { inventoryState } from './state'
export type { InventorySlot } from './state'
export { buildInventoryRouter } from './router'
