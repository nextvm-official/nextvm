import type { CharacterRepository, ModuleDefinition, ModuleLoader } from '@nextvm/core'
import type { DevBridgeOptions } from './dev-bridge'
import type { SnapshotOptions } from './state-snapshot'

/**
 * Options accepted by `bootstrapServer()`.
 */
export interface BootstrapOptions {
	/** Modules to register, in any order. The loader resolves dependencies. */
	modules: ModuleDefinition[]

	/**
	 * Optional CharacterRepository — usually a `DbCharacterRepository`
	 * from `@nextvm/db`. When omitted, the runtime falls back to an
	 * in-memory repository (handy for smoke-testing a single resource
	 * without a real DB).
	 */
	characterRepository?: CharacterRepository

	/**
	 * Optional `setupCompat()` callback — called once after the loader
	 * has finished `initialize()`. The runtime passes its FiveM-backed
	 * ExportsApi and a CompatDataSource bound to the live CharacterService.
	 *
	 * Importing `@nextvm/compat` here is opt-in so resources that don't
	 * need ESX/QBCore exports stay lean.
	 */
	registerCompat?: (args: {
		exportsApi: { register: (resource: string, name: string, fn: (...args: unknown[]) => unknown) => void }
		dataSource: import('./compat-data-source').RuntimeCompatDataSource
	}) => void

	/**
	 * Tick interval in milliseconds passed to `setTick`. Defaults to 0
	 * which lets FiveM run the loop on its own scheduler.
	 */
	tickIntervalMs?: number

	/**
	 * State hot-reload snapshot config (Concept Chapter 15.2).
	 *
	 *   - On `runtime.stop()` the runtime walks every registered state
	 *     store and writes one timestamped JSON file with their
	 *     `serialize()` output.
	 *   - On the next `bootstrapServer()` call, if that file exists
	 *     and is younger than `staleAfterMs` (default 60s), the runtime
	 *     deserializes every matching store and deletes the file.
	 *
	 * Set to `false` to disable the feature entirely.
	 */
	stateSnapshot?: SnapshotOptions | false

	/**
	 * Live ensure-restart bridge for `nextvm dev` (Concept Chapter 15.2).
	 *
	 * When set, the runtime watches `.nextvm/dev-trigger.json` and runs
	 * `ExecuteCommand('ensure <module>')` whenever the build orchestrator
	 * writes a new trigger. State is preserved automatically by the
	 * snapshot mechanism.
	 *
	 * Off by default — only enable in dev. `true` uses the defaults,
	 * an object overrides them.
	 */
	devBridge?: DevBridgeOptions | true
}

/**
 * The handle returned by `bootstrapServer()`. Tests use it to drive the
 * runtime deterministically; production code only ever calls `stop()`.
 */
export interface RuntimeHandle {
	loader: ModuleLoader
	/** Run a single tick frame (test helper) */
	runFrame(now?: number): Promise<void>
	/** Trigger the player connecting flow */
	handlePlayerConnecting(source: number, name: string, deferrals?: { defer: () => void; done: (reason?: string) => void }): Promise<void>
	/** Trigger the player joined flow (post-character-select) */
	handlePlayerReady(source: number): Promise<void>
	/** Trigger the player dropped flow */
	handlePlayerDropped(source: number, reason: string): Promise<void>
	/** Dispatch a server-side RPC request */
	dispatchRpc(source: number, namespace: string, procedure: string, input: unknown): Promise<unknown>
	/** Stop the runtime — runs onModuleStop hooks and clears the tick loop */
	stop(): Promise<void>
}
