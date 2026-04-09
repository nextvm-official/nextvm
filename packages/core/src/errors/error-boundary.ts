import { createLogger } from '../logger/logger'
import type { EventBus } from '../events/event-bus'
import { ErrorCounter } from './error-counter'
import type { ErrorOrigin } from './types'

/**
 * ErrorBoundary — Wraps handlers in try/catch + error counter integration.
 *   "NextVM wraps every module lifecycle hook, tick handler, event handler,
 *   and RPC handler in a try-catch boundary"
 * Workflow:
 *   1. Catch the error
 *   2. Log it with full context (module, handler, stack)
 *   3. Increment error counter for the module
 *   4. If threshold exceeded → mark module as degraded
 *      - Emit 'module:degraded' event
 *      - (Higher layers — ModuleLoader — disable tick handlers)
 *   5. Other modules continue unaffected
 */
export class ErrorBoundary {
	private log = createLogger('nextvm:errors')

	constructor(
		private readonly counter: ErrorCounter,
		private readonly eventBus: EventBus,
	) {}

	/** Wrap a sync handler call. Returns the result or undefined on error. */
	wrap<T>(
		module: string,
		origin: ErrorOrigin,
		handlerName: string,
		fn: () => T,
	): T | undefined {
		try {
			return fn()
		} catch (err) {
			this.report(module, origin, handlerName, err)
			return undefined
		}
	}

	/** Wrap an async handler call. Returns the result or undefined on error. */
	async wrapAsync<T>(
		module: string,
		origin: ErrorOrigin,
		handlerName: string,
		fn: () => T | Promise<T>,
	): Promise<T | undefined> {
		try {
			return await fn()
		} catch (err) {
			this.report(module, origin, handlerName, err)
			return undefined
		}
	}

	/**
	 * Report an error from a module.
	 * Logs, counts, and (if threshold reached) emits module:degraded.
	 */
	report(module: string, origin: ErrorOrigin, handlerName: string, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err)
		const stack = err instanceof Error ? err.stack : undefined

		this.log.error('Module handler threw', {
			module,
			origin,
			handler: handlerName,
			error: message,
			stack,
		})

		const justDegraded = this.counter.record(module, {
			origin,
			handler: handlerName,
			message,
			stack,
			timestamp: Date.now(),
		})

		if (justDegraded) {
			const status = this.counter.getStatus(module)
			this.log.error('CRITICAL: Module degraded — error threshold exceeded', {
				...status,
			})
			this.eventBus.emit('module:degraded', status)
		}
	}

	/** Check if a module is currently degraded */
	isDegraded(module: string): boolean {
		return this.counter.isDegraded(module)
	}

	/** Manually re-enable a degraded module */
	reEnable(module: string): void {
		this.counter.reEnable(module)
		this.eventBus.emit('module:recovered', { module })
		this.log.info('Module manually re-enabled', { module })
	}

	/** Get the underlying error counter (for introspection) */
	getCounter(): ErrorCounter {
		return this.counter
	}
}
