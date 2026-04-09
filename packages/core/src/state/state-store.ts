import { z, type ZodObject, type ZodRawShape } from 'zod'
import { createLogger } from '../logger/logger'
import type { StateBackend, StateData, StateSubscriber } from './types'

/**
 * StateStore — A typed, character-scoped state container.
 *   playerState.set(charId, 'cash', 1500)
 *   playerState.increment(charId, 'cash', 500)
 *   playerState.subscribe(charId, 'job', (newJob, oldJob) => { })
 */
export class StateStore<TShape extends ZodRawShape> {
	/** In-memory cache: charId → field → value */
	private cache = new Map<number, Map<string, unknown>>()
	/** Subscribers: charId → field → set of callbacks */
	private subscribers = new Map<number, Map<string, Set<StateSubscriber<unknown>>>>()
	private log: ReturnType<typeof createLogger>

	constructor(
		public readonly name: string,
		public readonly schema: ZodObject<TShape>,
		private readonly backend: StateBackend | null = null,
	) {
		this.log = createLogger(`nextvm:state:${name}`)
	}

	/**
	 * Set a field value for a character.
	 * Validates against the schema.
	 */
	set<K extends keyof StateData<TShape>>(
		charId: number,
		field: K,
		value: StateData<TShape>[K],
	): void {
		const fieldName = String(field)

		// Validate the single field value via the schema's shape
		const fieldSchema = this.schema.shape[fieldName]
		if (!fieldSchema) {
			throw new Error(`State '${this.name}' has no field '${fieldName}'`)
		}
		const result = (fieldSchema as z.ZodTypeAny).safeParse(value)
		if (!result.success) {
			throw new Error(
				`State '${this.name}.${fieldName}' validation failed: ${result.error.message}`,
			)
		}

		const oldValue = this.getRaw(charId, fieldName)
		this.setRaw(charId, fieldName, result.data)

		// Persist to backend (e.g., FiveM state bag)
		this.backend?.write(this.buildKey(charId, fieldName), result.data)

		// Fire subscribers
		this.notifySubscribers(charId, fieldName, result.data, oldValue)
	}

	/** Get a field value for a character. Returns the schema default if unset. */
	get<K extends keyof StateData<TShape>>(charId: number, field: K): StateData<TShape>[K] {
		const fieldName = String(field)
		const cached = this.getRaw(charId, fieldName)
		if (cached !== undefined) {
			return cached as StateData<TShape>[K]
		}

		// Try backend
		if (this.backend) {
			const fromBackend = this.backend.read(this.buildKey(charId, fieldName))
			if (fromBackend !== undefined) {
				this.setRaw(charId, fieldName, fromBackend)
				return fromBackend as StateData<TShape>[K]
			}
		}

		// Fall back to schema default
		const defaultData = this.schema.safeParse({})
		if (defaultData.success) {
			const value = (defaultData.data as Record<string, unknown>)[fieldName]
			return value as StateData<TShape>[K]
		}

		return undefined as StateData<TShape>[K]
	}

	/**
	 * Increment a numeric field by a delta.
	 * Throws if the field is not a number.
	 */
	increment<K extends keyof StateData<TShape>>(
		charId: number,
		field: K,
		delta: number,
	): number {
		const current = this.get(charId, field)
		if (typeof current !== 'number') {
			throw new Error(
				`State '${this.name}.${String(field)}' is not numeric, cannot increment`,
			)
		}
		const next = current + delta
		this.set(charId, field, next as StateData<TShape>[K])
		return next
	}

	/**
	 * Subscribe to changes on a specific field for a specific character.
	 * Returns an unsubscribe function.
	 */
	subscribe<K extends keyof StateData<TShape>>(
		charId: number,
		field: K,
		callback: StateSubscriber<StateData<TShape>[K]>,
	): () => void {
		const fieldName = String(field)
		let charSubs = this.subscribers.get(charId)
		if (!charSubs) {
			charSubs = new Map()
			this.subscribers.set(charId, charSubs)
		}
		let fieldSubs = charSubs.get(fieldName)
		if (!fieldSubs) {
			fieldSubs = new Set()
			charSubs.set(fieldName, fieldSubs)
		}
		fieldSubs.add(callback as StateSubscriber<unknown>)

		return () => {
			fieldSubs?.delete(callback as StateSubscriber<unknown>)
		}
	}

	/**
	 * Get the full state object for a character.
	 * Useful for serialization (e.g., character switch save).
	 */
	getAll(charId: number): StateData<TShape> {
		const result: Record<string, unknown> = {}
		for (const fieldName of Object.keys(this.schema.shape)) {
			result[fieldName] = this.get(charId, fieldName as keyof StateData<TShape>)
		}
		return result as StateData<TShape>
	}

	/**
	 * Replace all state for a character at once (validated).
	 * Useful for loading from DB on character select.
	 */
	loadAll(charId: number, data: StateData<TShape>): void {
		const result = this.schema.safeParse(data)
		if (!result.success) {
			throw new Error(
				`State '${this.name}' load validation failed: ${result.error.message}`,
			)
		}
		for (const [field, value] of Object.entries(result.data as Record<string, unknown>)) {
			this.setRaw(charId, field, value)
			this.backend?.write(this.buildKey(charId, field), value)
		}
	}

	/** Clear all state for a character (e.g., on disconnect) */
	clear(charId: number): void {
		this.cache.delete(charId)
		this.subscribers.delete(charId)
	}

	/**
	 * Hot-reload state preservation.
	 * Serialize all in-memory state for restoration after resource restart.
	 */
	serialize(): Record<number, Record<string, unknown>> {
		const result: Record<number, Record<string, unknown>> = {}
		for (const [charId, fields] of this.cache) {
			result[charId] = Object.fromEntries(fields)
		}
		return result
	}

	/** Restore state from a serialize() snapshot */
	deserialize(snapshot: Record<number, Record<string, unknown>>): void {
		for (const [charIdStr, fields] of Object.entries(snapshot)) {
			const charId = Number(charIdStr)
			for (const [field, value] of Object.entries(fields)) {
				this.setRaw(charId, field, value)
			}
		}
	}

	private getRaw(charId: number, field: string): unknown {
		return this.cache.get(charId)?.get(field)
	}

	private setRaw(charId: number, field: string, value: unknown): void {
		let charCache = this.cache.get(charId)
		if (!charCache) {
			charCache = new Map()
			this.cache.set(charId, charCache)
		}
		charCache.set(field, value)
	}

	private notifySubscribers(
		charId: number,
		field: string,
		newValue: unknown,
		oldValue: unknown,
	): void {
		const subs = this.subscribers.get(charId)?.get(field)
		if (!subs) return
		for (const cb of subs) {
			try {
				cb(newValue, oldValue)
			} catch (err) {
				this.log.error('State subscriber threw', {
					field,
					charId,
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}
	}

	private buildKey(charId: number, field: string): string {
		return `${this.name}:${charId}:${field}`
	}
}
