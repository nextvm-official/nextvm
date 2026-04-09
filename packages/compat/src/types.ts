/**
 * @nextvm/compat shared types.
 *
 * Concept v2.3, Chapter 16.
 */

/** A player-shaped item entry as ESX/QBCore expect it */
export interface CompatItem {
	name: string
	label: string
	count: number
	weight: number
}

/** ESX-style identifier list */
export interface CompatIdentifiers {
	license: string | null
	discord: string | null
	steam: string | null
}

/**
 * Source of NextVM data needed by the compat bridges.
 *
 * The setup function takes a DataSource so the bridges remain decoupled
 * from the concrete @nextvm/player and @nextvm/inventory module imports
 * (avoids cross-module imports — GUARD-002 spirit) and stays testable.
 */
export interface CompatDataSource {
	/** Resolve a server source ID to a NextVM character snapshot, or null */
	getCharacter(source: number): CompatCharacterSnapshot | null
	/** List all currently active player sources */
	getActiveSources(): number[]
}

/** Minimal character data the compat layer needs */
export interface CompatCharacterSnapshot {
	source: number
	charId: number
	identifiers: CompatIdentifiers
	firstName: string
	lastName: string
	cash: number
	bank: number
	job: string
	jobGrade: number
	position: { x: number; y: number; z: number }
	inventory: CompatItem[]
}

/**
 * Thin wrapper over the FiveM `exports[]` global.
 *
 * The compat package needs to register exports under arbitrary resource
 * names (`es_extended`, `qb-core`). Doing this through an injected
 * adapter keeps the package buildable on Node and unit-testable, while
 * the actual server bootstrap supplies the real FiveM exports.
 */
export interface ExportsApi {
	register(resource: string, name: string, fn: (...args: unknown[]) => unknown): void
}
