import type { ModuleEventBus } from '@nextvm/core'

/**
 * Mock event bus with assertion helpers.
 *
 * Concept v2.3, Chapter 31:
 *   Test-friendly mock that records every emitted event so tests can
 *   assert on what handlers were called and with what payloads.
 */
export interface MockEventBus extends ModuleEventBus {
	/** All events emitted since the bus was created (or last reset()) */
	getEmitted(): Array<{ event: string; data: unknown }>
	/** Get only events with a given name */
	getEmittedFor(event: string): unknown[]
	/** Throw if no event with this name was emitted */
	expectEmitted(event: string): void
	/** Throw if any event with this name was emitted */
	expectNotEmitted(event: string): void
	/** Clear the emission log + all subscribers */
	reset(): void
}

export function createMockEventBus(): MockEventBus {
	const handlers = new Map<string, Set<(data: unknown) => void>>()
	const emitted: Array<{ event: string; data: unknown }> = []

	return {
		emit(event, data) {
			emitted.push({ event, data })
			const set = handlers.get(event)
			if (set) for (const fn of set) fn(data)
		},
		on(event, handler) {
			if (!handlers.has(event)) handlers.set(event, new Set())
			handlers.get(event)!.add(handler)
		},
		off(event, handler) {
			handlers.get(event)?.delete(handler)
		},
		getEmitted() {
			return [...emitted]
		},
		getEmittedFor(event) {
			return emitted.filter((e) => e.event === event).map((e) => e.data)
		},
		expectEmitted(event) {
			if (!emitted.some((e) => e.event === event)) {
				throw new Error(
					`Expected event '${event}' to be emitted, but it was not. Emitted: ${emitted.map((e) => e.event).join(', ') || '(none)'}`,
				)
			}
		},
		expectNotEmitted(event) {
			const found = emitted.find((e) => e.event === event)
			if (found) {
				throw new Error(
					`Expected event '${event}' NOT to be emitted, but it was with data: ${JSON.stringify(found.data)}`,
				)
			}
		},
		reset() {
			handlers.clear()
			emitted.length = 0
		},
	}
}
