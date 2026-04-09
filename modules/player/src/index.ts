/**
 * @nextvm/player — First-party player module
 *
 * Concept v2.3, Chapter 8 + 18.
 *
 * Owns the runtime player state (position, health, armor, isDead) and
 * the player RPC router (getMe, teleport, revive, setHealth).
 *
 * - GUARD-001: no direct native calls (uses @nextvm/natives via state bags)
 * - GUARD-003: all writes server-authoritative
 * - GUARD-005: all RPC inputs Zod-validated
 * - GUARD-011: state keyed by charId, not source
 * - GUARD-012: user-facing strings via i18n
 */

import { defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import { playerRouter } from './router'
import { playerState } from './state'

export default defineModule({
	name: 'player',
	version: '0.1.0',

	config: z.object({
		startingHealth: z
			.number()
			.min(1)
			.max(200)
			.default(100)
			.describe('Initial health value when a character spawns'),
		respawnCoords: z
			.object({ x: z.number(), y: z.number(), z: z.number() })
			.default({ x: -269.4, y: -955.3, z: 31.2 })
			.describe('Coordinates used when reviving a player'),
	}),

	server: (ctx) => {
		ctx.log.info('player module loaded (server)')
		ctx.exposeRouter(playerRouter)

		// Initialize state on player ready
		ctx.onPlayerReady(async (player) => {
			const charId = player.character.id
			playerState.set(charId, 'health', 100)
			playerState.set(charId, 'armor', 0)
			playerState.set(charId, 'isDead', false)
			ctx.events.emit('player:spawned', { charId, source: player.source })
		})

		// Persist + clean up on disconnect
		ctx.onPlayerDropped(async (player) => {
			const charId = player.character.id
			ctx.events.emit('player:left', { charId, source: player.source })
			playerState.clear(charId)
		})
	},

	client: (ctx) => {
		ctx.log.info('player module loaded (client)')

		ctx.onMounted(() => {
			ctx.events.emit('player:mounted', {})
		})
	},

	shared: {
		schemas: { state: playerState },
		constants: { router: playerRouter, locales: { en: enLocale, de: deLocale } },
	},
})

// Re-export the router type so other modules / clients can derive client types
export { playerRouter } from './router'
export { playerState } from './state'
