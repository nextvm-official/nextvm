import { Network } from '@nextvm/natives'
import type { StateBackend } from './types'

/**
 * StateBagBackend — Persists state via FiveM Global State Bags.
 *
 * Bridges the @nextvm/core state system to FiveM's networked state bag
 * infrastructure. Values are auto-synced to clients via OneSync.
 *
 * Concept v2.3, Chapter 11: "Wraps FiveM State Bags with typing and reactivity."
 *
 * Note: This backend uses GlobalState with namespaced keys, which works
 * even when no specific entity is targeted. Modules that need entity- or
 * player-bound state bags can use the Network primitives directly.
 */
export class StateBagBackend implements StateBackend {
	read(key: string): unknown {
		return Network.getGlobalState(key)
	}

	write(key: string, value: unknown): void {
		Network.setGlobalState(key, value, true)
	}
}
