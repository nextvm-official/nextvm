/**
 * createBatchProcessor — Spread heavy entity work across multiple ticks.
 *   "createBatchProcessor() for spreading entity work across ticks."
 * Pattern: instead of iterating 1000 entities in a single tick (and
 * blowing the per-frame budget.2), give the processor a
 * chunk size and a worker. Each call to `tick()` advances the cursor
 * by `chunkSize` items. When the queue is exhausted, `done()` returns
 * true and the caller can refill it.
 * a managed tick alone is insufficient.
 * Usage (from a module's onTick):
 *   const batch = createBatchProcessor({
 *     chunkSize: 50,
 *     worker: (entity) => syncEntity(entity),
 *   })
 *   ctx.onTick(async () => {
 *     if (batch.done()) batch.fill(getAllEntities())
 *     await batch.tick()
 *   }, { interval: 100, priority: 'LOW' })
 */

export interface BatchProcessorOptions<T> {
	/** Items processed per tick() call */
	chunkSize: number
	/** Worker function — called once per item */
	worker: (item: T) => void | Promise<void>
	/** Optional initial queue */
	initial?: T[]
}

export interface BatchProcessor<T> {
	/** Process the next chunk. Resolves once the chunk is done. */
	tick(): Promise<{ processed: number; remaining: number }>
	/** Replace the queue with a new set of items */
	fill(items: T[]): void
	/** Append items to the back of the queue */
	enqueue(items: T[]): void
	/** True when the queue is empty */
	done(): boolean
	/** Number of items still queued */
	pending(): number
	/** Drop everything in the queue */
	clear(): void
}

export function createBatchProcessor<T>(opts: BatchProcessorOptions<T>): BatchProcessor<T> {
	if (opts.chunkSize < 1) {
		throw new Error('createBatchProcessor: chunkSize must be >= 1')
	}
	const queue: T[] = opts.initial ? [...opts.initial] : []
	let cursor = 0

	const compact = () => {
		if (cursor > 0) {
			queue.splice(0, cursor)
			cursor = 0
		}
	}

	return {
		async tick() {
			const end = Math.min(queue.length, cursor + opts.chunkSize)
			let processed = 0
			for (let i = cursor; i < end; i++) {
				await opts.worker(queue[i] as T)
				processed++
			}
			cursor = end
			if (cursor >= queue.length) {
				compact()
			}
			return { processed, remaining: queue.length - cursor }
		},
		fill(items) {
			queue.length = 0
			cursor = 0
			queue.push(...items)
		},
		enqueue(items) {
			queue.push(...items)
		},
		done() {
			return cursor >= queue.length
		},
		pending() {
			return queue.length - cursor
		},
		clear() {
			queue.length = 0
			cursor = 0
		},
	}
}
