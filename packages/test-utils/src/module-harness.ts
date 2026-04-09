import { defineRouter, RpcRouter, type Router } from '@nextvm/core'
import { createMockEventBus, type MockEventBus } from './mock-event-bus'
import { createMockLogger, type MockLogger } from './mock-logger'

/**
 * createModuleHarness — high-level test helper for module routers.
 *
 * Wraps an RpcRouter, an event bus, a logger, and a charId resolver in
 * one object so module router tests are one-liners. Compared to manually
 * instantiating an RpcRouter and calling .register() / .setCharIdResolver()
 * this:
 *
 *   - keeps every test isolated (fresh state per harness)
 *   - exposes recording event bus + logger so tests can assert on side
 *     effects without wiring spies
 *   - supports per-test injection of dependent modules so adapter
 *     contracts can be exercised end-to-end
 *
 * Usage:
 *   const harness = createModuleHarness({
 *     namespace: 'banking',
 *     router: buildBankingRouter(service),
 *   })
 *   const result = await harness.dispatch(1, 'transfer', {
 *     toCharId: 2, type: 'cash', amount: 100,
 *   })
 *   harness.expectEvent('banking:transactionCompleted')
 */

export interface ModuleHarnessOptions<TRouter extends Router> {
	/** RPC namespace under which the router is registered */
	namespace: string
	/** The router built from the module's defineRouter() output */
	router: TRouter
	/** Optional 1:1 source → charId mapping (default: identity) */
	charIdResolver?: (source: number) => number | null
}

export interface ModuleHarness<TRouter extends Router> {
	/** Dispatch a procedure call against the module router */
	dispatch(source: number, procedure: keyof TRouter & string, input?: unknown): Promise<unknown>
	/** Recording event bus — assert via expectEmitted() */
	events: MockEventBus
	/** Recording logger — assert via expectMessage() */
	log: MockLogger
	/** Underlying RpcRouter instance for advanced wiring */
	rpc: RpcRouter
	/** Reset events + logger between tests in the same describe block */
	reset(): void
}

export function createModuleHarness<TRouter extends Router>(
	options: ModuleHarnessOptions<TRouter>,
): ModuleHarness<TRouter> {
	const events = createMockEventBus()
	const log = createMockLogger()
	const rpc = new RpcRouter()
	rpc.register(options.namespace, options.router as Router)
	rpc.setCharIdResolver(options.charIdResolver ?? ((source) => source))

	return {
		dispatch(source, procedure, input) {
			return rpc.dispatch(source, options.namespace, procedure, input)
		},
		events,
		log,
		rpc,
		reset() {
			events.reset()
			log.reset()
		},
	}
}

/**
 * Convenience: build a harness inline from a router definition.
 *
 * Useful when the test only needs the dispatch helper and doesn't
 * care about exposing the underlying router separately.
 */
export function harnessFor<TRouter extends Router>(
	namespace: string,
	router: TRouter,
): ModuleHarness<TRouter> {
	return createModuleHarness({ namespace, router })
}

// Re-export defineRouter so tests can build inline routers without
// pulling @nextvm/core directly.
export { defineRouter }
