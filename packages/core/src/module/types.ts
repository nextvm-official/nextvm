import type { ZodObject, ZodRawShape } from 'zod'
import type { Router } from '../rpc/types'

/**
 * Module definition — the shape passed to defineModule().
 * Concept v2.3, Chapter 8.1.
 */
export interface ModuleDefinition<TConfig extends ZodRawShape = ZodRawShape> {
	name: string
	version: string
	dependencies?: string[]
	config?: ZodObject<TConfig>
	server?: (ctx: ModuleContext) => void | Promise<void>
	client?: (ctx: ModuleContext) => void | Promise<void>
	shared?: {
		schemas?: Record<string, unknown>
		constants?: Record<string, unknown>
	}
}

/**
 * Module context — injected into server/client functions.
 * Concept v2.3, Chapter 8.1 + 8.2 + 8.3.
 */
export interface ModuleContext {
	/** Module name */
	readonly name: string
	/** Resolved and validated config values */
	readonly config: Record<string, unknown>
	/** Inject a dependency by module name (DI — Chapter 8.2) */
	inject: <T = unknown>(moduleName: string) => T
	/**
	 * Publish this module's public service surface.
	 *
	 * Other modules call `ctx.inject<T>('this-module')` to receive the
	 * exact object passed here. Replaces the older `(ctx as unknown)
	 * .exports` cast pattern with a typed setter.
	 */
	setExports: <T extends Record<string, unknown>>(exports: T) => void
	/**
	 * Publish this module's RPC router so the runtime can register it on
	 * its own RpcRouter under the module's namespace. The router is dispatched
	 * for inbound `__nextvm:rpc` events from clients (Concept Chapter 10.1).
	 */
	exposeRouter: (router: Router) => void
	/** Typed event bus (Chapter 8.4) */
	events: ModuleEventBus
	/** Logger scoped to this module (Chapter 22.1) */
	log: ModuleLogger
	/** Lifecycle hooks (Chapter 8.3) — all 9 concept hooks */
	onModuleInit: (handler: () => void | Promise<void>) => void
	onModuleReady: (handler: () => void | Promise<void>) => void
	onModuleStop: (handler: () => void | Promise<void>) => void
	onPlayerConnecting: (handler: PlayerConnectingHandler) => void
	onPlayerReady: (handler: PlayerHandler) => void
	onPlayerDropped: (handler: PlayerDroppedHandler) => void
	/** Client-side: local player spawned, framework ready (Chapter 8.3) */
	onMounted: (handler: () => void | Promise<void>) => void
	onCharacterSwitch: (handler: CharacterSwitchHandler) => void
	onBucketChange: (handler: BucketChangeHandler) => void
	onTick: (handler: TickHandler, opts?: TickOptions) => void
}

/**
 * Typed event bus — inter-module communication.
 * Concept v2.3, Chapter 8.4: "Typed event bus, not direct imports"
 */
export interface ModuleEventBus {
	emit: (event: string, data?: unknown) => void
	on: (event: string, handler: (data: unknown) => void) => void
	off: (event: string, handler: (data: unknown) => void) => void
}

/**
 * Structured logger per module.
 * Concept v2.3, Chapter 22.1: JSON output, per-module context.
 */
export interface ModuleLogger {
	debug: (msg: string, data?: Record<string, unknown>) => void
	info: (msg: string, data?: Record<string, unknown>) => void
	warn: (msg: string, data?: Record<string, unknown>) => void
	error: (msg: string, data?: Record<string, unknown>) => void
}

// --- Lifecycle Handler Types (Chapter 8.3) ---

/** Player info passed to lifecycle hooks */
export interface PlayerInfo {
	source: number
	user: { id: number }
	character: { id: number }
}

/** Deferred connection object for onPlayerConnecting */
export interface DeferralHandle {
	defer: () => void
	update: (message: string) => void
	done: (failureReason?: string) => void
}

export type PlayerConnectingHandler = (
	playerName: string,
	deferrals: DeferralHandle,
	source: number,
) => void | Promise<void>

export type PlayerHandler = (player: PlayerInfo) => void | Promise<void>

export type PlayerDroppedHandler = (
	player: PlayerInfo,
	reason: string,
) => void | Promise<void>

export type CharacterSwitchHandler = (
	player: PlayerInfo,
	oldCharId: number,
	newCharId: number,
) => void | Promise<void>

export type BucketChangeHandler = (
	source: number,
	oldBucket: number,
	newBucket: number,
) => void | Promise<void>

export type TickHandler = () => void

/** Tick priority for managed tick system (Chapter 21.1) */
export type TickPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface TickOptions {
	/** Minimum interval in ms between ticks */
	interval?: number
	/** Priority level — LOW ticks may be skipped under load */
	priority?: TickPriority
}
