import type { ModuleEventBus } from '../module/types'

/** Optional error reporter — called when a handler throws */
export type EventErrorReporter = (
	module: string | null,
	event: string,
	error: unknown,
) => void

/**
 * Typed Event Bus — inter-module communication.
 *
 * Concept v2.3, Chapter 8.4:
 *   "Typed event bus, not direct imports"
 *   ctx.events.emit('banking:transaction', { from, to, amount })
 *   ctx.events.on('banking:transaction', (data) => { ... })
 *
 * Concept v2.3, Chapter 22.2 — Error Boundaries:
 *   Each handler is wrapped in try/catch. When an error reporter is set,
 *   errors are forwarded for tracking and threshold-based degradation.
 *
 * GUARD-002: Modules never import each other directly.
 * GUARD-004: Typed events only. No raw TriggerServerEvent.
 */
export class EventBus implements ModuleEventBus {
	private handlers = new Map<string, Set<HandlerEntry>>()
	private errorReporter: EventErrorReporter | null = null

	/** Emit an event with optional data */
	emit(event: string, data?: unknown): void {
		const eventHandlers = this.handlers.get(event)
		if (!eventHandlers) return

		for (const entry of eventHandlers) {
			try {
				entry.handler(data)
			} catch (err) {
				if (this.errorReporter) {
					this.errorReporter(entry.module, event, err)
				} else {
					console.error(
						JSON.stringify({
							level: 'ERROR',
							msg: 'Event handler threw an error',
							data: {
								event,
								module: entry.module,
								error: err instanceof Error ? err.message : String(err),
								stack: err instanceof Error ? err.stack : undefined,
							},
							timestamp: new Date().toISOString(),
						}),
					)
				}
			}
		}
	}

	/** Subscribe to an event (no module attribution) */
	on(event: string, handler: (data: unknown) => void): void {
		this.onFromModule(event, handler, null)
	}

	/**
	 * Subscribe to an event with module attribution.
	 * Used by ModuleContext to track which module owns the handler.
	 */
	onFromModule(
		event: string,
		handler: (data: unknown) => void,
		module: string | null,
	): void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, new Set())
		}
		this.handlers.get(event)!.add({ handler, module })
	}

	/** Unsubscribe from an event */
	off(event: string, handler: (data: unknown) => void): void {
		const set = this.handlers.get(event)
		if (!set) return
		for (const entry of set) {
			if (entry.handler === handler) {
				set.delete(entry)
				return
			}
		}
	}

	/** Remove all handlers for an event */
	removeAllListeners(event: string): void {
		this.handlers.delete(event)
	}

	/** Get the number of handlers for an event */
	listenerCount(event: string): number {
		return this.handlers.get(event)?.size ?? 0
	}

	/**
	 * Set the error reporter — called by ModuleLoader to wire up
	 * error counting and threshold-based degradation (Chapter 22.2).
	 */
	setErrorReporter(reporter: EventErrorReporter | null): void {
		this.errorReporter = reporter
	}
}

interface HandlerEntry {
	handler: (data: unknown) => void
	module: string | null
}
