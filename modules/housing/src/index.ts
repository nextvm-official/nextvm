/**
 * @nextvm/housing — Phase 2 housing module
 *
 * Concept v2.3, Chapter 7.2 + 8 + 18.
 *
 * Owns property definitions, character ownership, and routing-bucket
 * instancing for apartment interiors. Server-authoritative purchases
 * (GUARD-003), char-id keyed state (GUARD-011), Zod-validated RPC
 * (GUARD-005), i18n strings (GUARD-012). Cross-module access to
 * banking goes through a small adapter interface (GUARD-002).
 */

import { defineExports, defineModule, z } from '@nextvm/core'
import { RoutingService } from '@nextvm/natives'
import type { BankingAdapter } from './banking-adapter'
import { PropertyRegistry } from './property-registry'
import { buildHousingRouter } from './router'
import { HousingService } from './service'
import { housingState } from './state'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'

/** Public service surface — consumed via inject<HousingExports>('housing') */
export type HousingExports = ReturnType<typeof buildHousingExports>

function buildHousingExports(service: HousingService) {
	return defineExports({
		service,
		purchase: service.purchase.bind(service),
		enter: service.enter.bind(service),
		leave: service.leave.bind(service),
		getOwned: service.getOwned.bind(service),
	})
}

export default defineModule({
	name: 'housing',
	version: '0.1.0',
	dependencies: ['player', 'banking'],

	config: z.object({
		minPropertyPrice: z
			.number()
			.int()
			.min(0)
			.default(50000)
			.describe('Lower bound applied when seed properties are loaded'),
	}),

	server: (ctx) => {
		const registry = new PropertyRegistry()

		// Seed a couple of starter properties so the module is usable
		// out of the box. Real servers replace this list via their own
		// data files or DB-backed loader.
		registry.define({
			id: 'apt_eclipse_3',
			label: 'Eclipse Towers Apt 3',
			type: 'apartment',
			entrance: { x: -773.4, y: 341.6, z: 211.4 },
			price: 75000,
			maxOccupants: 4,
		})
		registry.define({
			id: 'apt_tinsel_42',
			label: 'Tinsel Towers Apt 42',
			type: 'apartment',
			entrance: { x: -616.2, y: 40.0, z: 96.4 },
			price: 90000,
			maxOccupants: 4,
		})
		registry.define({
			id: 'house_richman',
			label: 'Richman Mansion',
			type: 'house',
			entrance: { x: -174.7, y: 502.2, z: 137.6 },
			price: 1250000,
			maxOccupants: 8,
		})

		const routing = new RoutingService()
		const service = new HousingService(registry, routing)
		const router = buildHousingRouter(service)

		// Wire the banking dependency via DI (Concept Chapter 8.2)
		try {
			const banking = ctx.inject<{ removeMoney: BankingAdapter['removeMoney'] }>(
				'banking',
			)
			service.setBanking(banking)
		} catch {
			ctx.log.warn('banking module not available — property purchases disabled')
		}

		// Publish the public surface
		ctx.setExports(buildHousingExports(service))
		ctx.exposeRouter(router)

		ctx.log.info('housing module loaded (server)', {
			properties: registry.all().length,
			procedures: Object.keys(router).length,
		})

		ctx.onPlayerReady(async (player) => {
			// Ensure the state is initialized for the new character
			const owned = housingState.get(player.character.id, 'ownedPropertyIds')
			if (!owned) housingState.set(player.character.id, 'ownedPropertyIds', [])
		})

		ctx.onPlayerDropped(async (player) => {
			housingState.clear(player.character.id)
		})
	},

	client: (ctx) => {
		ctx.log.info('housing module loaded (client)')
	},

	shared: {
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

export { PropertyRegistry, defineProperty } from './property-registry'
export type { PropertyDefinition, PropertyType } from './property-registry'
export { HousingService } from './service'
export type { BankingAdapter } from './banking-adapter'
export { buildHousingRouter } from './router'
export { housingState } from './state'
