import type { z, ZodObject, ZodRawShape } from 'zod'

/**
 * State Management Types.
 *
 * Concept v2.3, Chapter 11.
 */

/** A subscription callback for state changes */
export type StateSubscriber<T> = (newValue: T, oldValue: T) => void

/** Backend interface for persisting state — abstraction over FiveM state bags */
export interface StateBackend {
	/**
	 * Read a value from the backend.
	 * Key format: `<state-name>:<charId>:<field>`
	 */
	read(key: string): unknown
	/**
	 * Write a value to the backend.
	 * Implementations may sync to FiveM state bags here.
	 */
	write(key: string, value: unknown): void
}

/** Inferred shape of a state definition's data */
export type StateData<TShape extends ZodRawShape> = z.infer<ZodObject<TShape>>
