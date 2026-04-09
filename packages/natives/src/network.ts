import type { EntityHandle, PlayerSource } from './types'

/**
 * Network — Typed wrappers for FiveM networking primitives.
 *
 * Concept v2.3, Chapter 7.1:
 *   Wraps: Events, state bags, RPC foundations
 *   Key abstractions: Typed event system, RPC router
 *
 * Note: The full RPC system lives in @nextvm/core (Layer 3).
 * This layer provides the low-level network primitives that core builds upon.
 */
export class Network {
	private constructor() {}

	// --- State Bags ---

	/** Set a global state value (synced to all clients) */
	static setGlobalState(key: string, value: unknown, replicated?: boolean): void {
		GlobalState.set(key, value, replicated ?? true)
	}

	/** Get a global state value */
	static getGlobalState(key: string): unknown {
		return GlobalState[key]
	}

	/** Set a player's state bag value */
	static setPlayerState(
		source: PlayerSource,
		key: string,
		value: unknown,
		replicated?: boolean,
	): void {
		const player = Player(String(source))
		if (player?.state) {
			player.state.set(key, value, replicated ?? true)
		}
	}

	/** Get a player's state bag value */
	static getPlayerState(source: PlayerSource, key: string): unknown {
		const player = Player(String(source))
		return player?.state?.[key]
	}

	/** Set an entity's state bag value */
	static setEntityState(
		entity: EntityHandle,
		key: string,
		value: unknown,
		replicated?: boolean,
	): void {
		const ent = Entity(entity)
		if (ent?.state) {
			ent.state.set(key, value, replicated ?? true)
		}
	}

	/** Get an entity's state bag value */
	static getEntityState(entity: EntityHandle, key: string): unknown {
		const ent = Entity(entity)
		return ent?.state?.[key]
	}

	/**
	 * Register a state bag change handler.
	 * Returns a cookie that can be used to remove the handler.
	 */
	static onStateBagChange(
		keyFilter: string,
		handler: (
			bagName: string,
			key: string,
			value: unknown,
			reserved: number,
			replicated: boolean,
		) => void,
	): number {
		return AddStateBagChangeHandler(keyFilter, '', handler)
	}

	/** Remove a state bag change handler */
	static removeStateBagChangeHandler(cookie: number): void {
		RemoveStateBagChangeHandler(cookie)
	}

	// --- Events (low-level) ---

	/**
	 * Register a server net event handler.
	 * Note: Modules should use @nextvm/core's typed event bus (GUARD-004),
	 * not these low-level primitives directly.
	 */
	static onServerEvent(
		eventName: string,
		handler: (...args: unknown[]) => void,
	): void {
		RegisterNetEvent(eventName)
		on(eventName, handler)
	}

	/** Emit an event to a specific client */
	static emitClient(
		eventName: string,
		target: PlayerSource | -1,
		...args: unknown[]
	): void {
		TriggerClientEvent(eventName, target, ...args)
	}

	/** Emit an event to all clients */
	static emitAllClients(eventName: string, ...args: unknown[]): void {
		TriggerClientEvent(eventName, -1, ...args)
	}

	// --- Player Utilities ---

	/** Get all connected player source IDs */
	static getPlayers(): PlayerSource[] {
		const players: PlayerSource[] = []
		const count = GetNumPlayerIndices()
		for (let i = 0; i < count; i++) {
			const source = Number(GetPlayerFromIndex(i))
			if (source > 0) players.push(source)
		}
		return players
	}

	/** Get the current player count */
	static getPlayerCount(): number {
		return GetNumPlayerIndices()
	}

	/** Get the server's max players setting */
	static getMaxPlayers(): number {
		return GetConvarInt('sv_maxclients', 32)
	}
}
