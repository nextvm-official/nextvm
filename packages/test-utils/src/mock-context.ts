import type { ModuleContext, PlayerInfo } from '@nextvm/core'
import { createMockEventBus, type MockEventBus } from './mock-event-bus'
import { createMockLogger, type MockLogger } from './mock-logger'

/**
 * Mock ModuleContext with full assertion support.
 *   createMockContext() — fully wired ModuleContext for unit tests.
 * The returned object is a real ModuleContext PLUS a `harness` field
 * that exposes the recording event bus, the recording logger, and the
 * lifecycle handler buckets so tests can inspect what the module did.
 */
export interface MockContextOptions {
	name?: string
	config?: Record<string, unknown>
	charId?: number | null
	/** Map of module name → exports object that inject() should return */
	injections?: Record<string, unknown>
}

export interface MockContext extends ModuleContext {
	harness: {
		events: MockEventBus
		log: MockLogger
		/** Lifecycle handler buckets registered by the module under test */
		lifecycle: {
			onModuleInit: Array<() => void | Promise<void>>
			onModuleReady: Array<() => void | Promise<void>>
			onModuleStop: Array<() => void | Promise<void>>
			onPlayerConnecting: Array<unknown>
			onPlayerReady: Array<(player: PlayerInfo) => void | Promise<void>>
			onPlayerDropped: Array<unknown>
			onMounted: Array<() => void | Promise<void>>
			onCharacterSwitch: Array<unknown>
			onBucketChange: Array<unknown>
			onTick: Array<{ handler: () => void; opts: unknown }>
		}
		/** Trigger registered onPlayerReady handlers with a fake player */
		fireOnPlayerReady(player: PlayerInfo): Promise<void>
		/** Trigger registered onModuleReady handlers */
		fireOnModuleReady(): Promise<void>
		/** Trigger registered onModuleStop handlers */
		fireOnModuleStop(): Promise<void>
	}
}

export function createMockContext(options: MockContextOptions = {}): MockContext {
	const events = createMockEventBus()
	const log = createMockLogger()
	const injections = options.injections ?? {}

	const lifecycle: MockContext['harness']['lifecycle'] = {
		onModuleInit: [],
		onModuleReady: [],
		onModuleStop: [],
		onPlayerConnecting: [],
		onPlayerReady: [],
		onPlayerDropped: [],
		onMounted: [],
		onCharacterSwitch: [],
		onBucketChange: [],
		onTick: [],
	}

	const ctx: MockContext = {
		name: options.name ?? 'test-module',
		config: options.config ?? {},
		inject: <T = unknown>(moduleName: string): T => {
			if (!(moduleName in injections)) {
				throw new Error(
					`inject('${moduleName}') has no mock binding. Pass it via createMockContext({ injections: { ${moduleName}: ... } }).`,
				)
			}
			return injections[moduleName] as T
		},
		setExports: <T extends Record<string, unknown>>(exports: T) => {
			// In the mock context the module's own exports are stashed
			// under its own name so a follow-up inject(name) returns them.
			injections[options.name ?? 'test-module'] = exports
		},
		exposeRouter: () => {
			// no-op in the mock context — module-harness wires routers via
			// its own RpcRouter directly
		},
		events,
		log,
		onModuleInit: (h) => lifecycle.onModuleInit.push(h),
		onModuleReady: (h) => lifecycle.onModuleReady.push(h),
		onModuleStop: (h) => lifecycle.onModuleStop.push(h),
		onPlayerConnecting: (h) => lifecycle.onPlayerConnecting.push(h),
		onPlayerReady: (h) => lifecycle.onPlayerReady.push(h),
		onPlayerDropped: (h) => lifecycle.onPlayerDropped.push(h),
		onMounted: (h) => lifecycle.onMounted.push(h),
		onCharacterSwitch: (h) => lifecycle.onCharacterSwitch.push(h),
		onBucketChange: (h) => lifecycle.onBucketChange.push(h),
		onTick: (handler, opts) => lifecycle.onTick.push({ handler, opts: opts ?? {} }),
		harness: {
			events,
			log,
			lifecycle,
			async fireOnPlayerReady(player) {
				for (const h of lifecycle.onPlayerReady) {
					await h(player)
				}
			},
			async fireOnModuleReady() {
				for (const h of lifecycle.onModuleReady) await h()
			},
			async fireOnModuleStop() {
				for (const h of lifecycle.onModuleStop) await h()
			},
		},
	}

	return ctx
}
