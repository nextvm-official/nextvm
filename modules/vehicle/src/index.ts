/**
 * @nextvm/vehicle — First-party vehicle module
 *
 * Concept v2.3, Chapter 8 + 18.
 *
 * Owns vehicle ownership state, spawn/despawn RPCs, and the basic
 * lifecycle around player-owned vehicles.
 *
 * - GUARD-001: spawn via @nextvm/natives NextVMVehicle, no raw natives
 * - GUARD-002: depends on 'player' via DI, no direct import
 * - GUARD-003: server-authoritative
 * - GUARD-005: Zod-validated RPC inputs
 * - GUARD-011: state keyed by charId
 * - GUARD-012: i18n strings
 */

import { defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import { vehicleRouter } from './router'
import { vehicleState } from './state'

export default defineModule({
	name: 'vehicle',
	version: '0.1.0',
	dependencies: ['player'],

	config: z.object({
		maxOwnedVehicles: z
			.number()
			.int()
			.min(0)
			.max(100)
			.default(5)
			.describe('Maximum vehicles a character can own'),
	}),

	server: (ctx) => {
		ctx.log.info('vehicle module loaded (server)')
		ctx.exposeRouter(vehicleRouter)

		ctx.onPlayerReady(async (player) => {
			const charId = player.character.id
			// Initialize empty ownership list
			const current = vehicleState.get(charId, 'ownedNetIds')
			if (!current || current.length === 0) {
				vehicleState.set(charId, 'ownedNetIds', [])
			}
		})

		ctx.onPlayerDropped(async (player) => {
			vehicleState.clear(player.character.id)
		})
	},

	client: (ctx) => {
		ctx.log.info('vehicle module loaded (client)')
	},

	shared: {
		schemas: { state: vehicleState },
		constants: { router: vehicleRouter, locales: { en: enLocale, de: deLocale } },
	},
})

export { vehicleRouter } from './router'
export { vehicleState } from './state'
