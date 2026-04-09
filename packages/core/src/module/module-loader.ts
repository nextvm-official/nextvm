import { DIContainer } from '../di/container'
import { ErrorBoundary } from '../errors/error-boundary'
import { ErrorCounter } from '../errors/error-counter'
import { EventBus } from '../events/event-bus'
import { createLogger } from '../logger/logger'
import { Profiler } from '../performance/profiler'
import type { Router } from '../rpc/types'
import { StateStore } from '../state/state-store'
import { TickScheduler } from '../tick/scheduler'
import type {
	BucketChangeHandler,
	CharacterSwitchHandler,
	ModuleContext,
	ModuleDefinition,
	PlayerConnectingHandler,
	PlayerDroppedHandler,
	PlayerHandler,
	TickHandler,
	TickOptions,
} from './types'

/**
 * Module Loader — orchestrates module registration, validation, and lifecycle.
 *
 * Concept v2.3, Chapter 8:
 *   - Registers modules via defineModule()
 *   - Resolves dependency order (DI — Chapter 8.2)
 *   - Validates configs with Zod (GUARD-005, GUARD-009)
 *   - Runs lifecycle hooks in order (Chapter 8.3)
 *   - Provides ModuleContext to each module
 *
 * Concept v2.3, Chapter 22.2 — Error Boundaries:
 *   "A crashing module must not take down the server or other modules"
 */
export class ModuleLoader {
	private container = new DIContainer()
	private exposedRouters = new Map<string, Router>()
	private eventBus = new EventBus()
	private errorBoundary = new ErrorBoundary(new ErrorCounter(), this.eventBus)
	private tickScheduler = new TickScheduler()
	private profiler = new Profiler()

	constructor() {
		// Wire EventBus errors into the error boundary (Chapter 22.2)
		this.eventBus.setErrorReporter((module, event, err) => {
			this.errorBoundary.report(
				module ?? 'unknown',
				'event-handler',
				event,
				err,
			)
		})

		// Tick handlers also flow through the error boundary so degraded
		// modules are skipped automatically (Chapter 21.1 + 22.2)
		this.tickScheduler.setErrorBoundary(this.errorBoundary)

		// Tick durations are sampled by the profiler so `nextvm perf`
		// can surface per-module hot spots (Chapter 21.2)
		this.tickScheduler.setProfiler(this.profiler)
	}

	private lifecycleHandlers = {
		onModuleInit: new Map<string, Array<() => void | Promise<void>>>(),
		onModuleReady: new Map<string, Array<() => void | Promise<void>>>(),
		onModuleStop: new Map<string, Array<() => void | Promise<void>>>(),
		onPlayerConnecting: new Map<string, PlayerConnectingHandler[]>(),
		onPlayerReady: new Map<string, PlayerHandler[]>(),
		onPlayerDropped: new Map<string, PlayerDroppedHandler[]>(),
		onMounted: new Map<string, Array<() => void | Promise<void>>>(),
		onCharacterSwitch: new Map<string, CharacterSwitchHandler[]>(),
		onBucketChange: new Map<string, BucketChangeHandler[]>(),
		onTick: new Map<string, Array<{ handler: TickHandler; opts: TickOptions }>>(),
	}

	/** Register a module definition */
	register(definition: ModuleDefinition): void {
		this.container.register(definition)
	}

	/**
	 * Initialize all registered modules.
	 * Resolves dependencies, validates configs, runs server/client functions.
	 */
	async initialize(side: 'server' | 'client'): Promise<void> {
		const order = this.container.resolveDependencyOrder()
		const logger = createLogger('nextvm:loader')

		logger.info('Initializing modules', {
			side,
			order,
			count: order.length,
		})

		for (const name of order) {
			const definition = this.container.getModule(name)
			if (!definition) continue

			// Validate config with Zod (GUARD-005, GUARD-009)
			let resolvedConfig: Record<string, unknown> = {}
			if (definition.config) {
				const result = definition.config.safeParse({})
				if (!result.success) {
					logger.error('Config validation failed', {
						module: name,
						errors: result.error.issues,
					})
					throw new Error(
						`Module '${name}' config validation failed: ${result.error.message}`,
					)
				}
				resolvedConfig = result.data as Record<string, unknown>
			}

			// Build module context
			const ctx = this.createContext(name, resolvedConfig)

			// Run the module's server or client function
			const entryFn = side === 'server' ? definition.server : definition.client
			if (entryFn) {
				try {
					await entryFn(ctx)
					logger.info('Module initialized', { module: name, side })
				} catch (err) {
					// Error boundary (Chapter 22.2)
					logger.error('Module initialization failed', {
						module: name,
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined,
					})
					throw err // Init errors are fatal — module can't function without init
				}
			}
		}

		// Fire onModuleInit for all modules
		for (const name of order) {
			const handlers = this.lifecycleHandlers.onModuleInit.get(name)
			if (handlers) {
				for (const handler of handlers) {
					await this.safeCall(name, 'onModuleInit', handler)
				}
			}
		}

		// Fire onModuleReady for all modules (all modules are now init)
		for (const name of order) {
			const handlers = this.lifecycleHandlers.onModuleReady.get(name)
			if (handlers) {
				for (const handler of handlers) {
					await this.safeCall(name, 'onModuleReady', handler)
				}
			}
		}

		logger.info('All modules ready', { count: order.length, side })
	}

	/** Create a ModuleContext for a specific module */
	private createContext(
		name: string,
		config: Record<string, unknown>,
	): ModuleContext {
		const log = createLogger(name)

		const ensureHandlerList = <T>(
			map: Map<string, T[]>,
		): T[] => {
			if (!map.has(name)) map.set(name, [])
			return map.get(name)!
		}

		// Per-module event bus wrapper that attributes handlers to this module
		// for the error boundary (Concept Chapter 22.2)
		const moduleEventBus = {
			emit: (event: string, data?: unknown) => this.eventBus.emit(event, data),
			on: (event: string, handler: (data: unknown) => void) =>
				this.eventBus.onFromModule(event, handler, name),
			off: (event: string, handler: (data: unknown) => void) =>
				this.eventBus.off(event, handler),
		}

		return {
			name,
			config,
			inject: <T = unknown>(moduleName: string) =>
				this.container.inject<T>(moduleName),
			setExports: <T extends Record<string, unknown>>(exports: T) => {
				this.container.setResolved(name, exports)
			},
			exposeRouter: (router: Router) => {
				if (this.exposedRouters.has(name)) {
					throw new Error(`Module '${name}' has already exposed a router`)
				}
				this.exposedRouters.set(name, router)
			},
			events: moduleEventBus,
			log,
			onModuleInit: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onModuleInit).push(handler)
			},
			onModuleReady: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onModuleReady).push(handler)
			},
			onModuleStop: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onModuleStop).push(handler)
			},
			onPlayerConnecting: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onPlayerConnecting).push(handler)
			},
			onPlayerReady: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onPlayerReady).push(handler)
			},
			onPlayerDropped: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onPlayerDropped).push(handler)
			},
			onMounted: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onMounted).push(handler)
			},
			onCharacterSwitch: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onCharacterSwitch).push(handler)
			},
			onBucketChange: (handler) => {
				ensureHandlerList(this.lifecycleHandlers.onBucketChange).push(handler)
			},
			onTick: (handler, opts) => {
				// Track in lifecycleHandlers for introspection AND register
				// with the TickScheduler so the managed loop picks it up
				// (Concept Chapter 21.1).
				ensureHandlerList(this.lifecycleHandlers.onTick).push({
					handler,
					opts: opts ?? {},
				})
				this.tickScheduler.register(name, handler, opts)
			},
		}
	}

	/** Get the shared event bus */
	getEventBus(): EventBus {
		return this.eventBus
	}

	/** Get the managed tick scheduler (call runFrame() from a setTick loop) */
	getTickScheduler(): TickScheduler {
		return this.tickScheduler
	}

	/** Get the shared profiler — feed RPC routers via setProfiler() */
	getProfiler(): Profiler {
		return this.profiler
	}

	/** Get the DI container */
	getContainer(): DIContainer {
		return this.container
	}

	/** Get all handlers for a lifecycle event */
	getLifecycleHandlers<K extends keyof typeof this.lifecycleHandlers>(
		event: K,
	): (typeof this.lifecycleHandlers)[K] {
		return this.lifecycleHandlers[event]
	}

	/**
	 * Safely call a handler with error boundary.
	 * Concept v2.3, Chapter 22.2:
	 *   "A crashing module must not take down the server or other modules"
	 *   "If errors exceed threshold (default 10/minute), disable tick handlers
	 *    and emit module:degraded event."
	 */
	private async safeCall(
		moduleName: string,
		hookName: string,
		handler: () => void | Promise<void>,
	): Promise<void> {
		await this.errorBoundary.wrapAsync(moduleName, 'lifecycle', hookName, handler)
	}

	/** Get the error boundary (for introspection / admin tools) */
	getErrorBoundary(): ErrorBoundary {
		return this.errorBoundary
	}

	/** Get every router exposed via `ctx.exposeRouter()`, keyed by module name */
	getExposedRouters(): Map<string, Router> {
		return this.exposedRouters
	}

	/**
	 * Walk every registered module's `shared.schemas.state` and collect
	 * the StateStore instances, keyed by `<moduleName>.<schemaKey>`.
	 *
	 * Used by the runtime layer to drive `serialize()` / `deserialize()`
	 * snapshots across resource restarts (Concept Chapter 15.2).
	 */
	getStateStores(): Map<string, StateStore<Record<string, never>>> {
		const result = new Map<string, StateStore<Record<string, never>>>()
		for (const name of this.container.getModuleNames()) {
			const definition = this.container.getModule(name)
			const schemas = definition?.shared?.schemas
			if (!schemas) continue
			for (const [key, value] of Object.entries(schemas)) {
				if (value instanceof StateStore) {
					result.set(`${name}.${key}`, value as StateStore<Record<string, never>>)
				}
			}
		}
		return result
	}
}
