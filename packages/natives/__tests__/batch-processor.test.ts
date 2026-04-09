import { describe, expect, it, vi } from 'vitest'
import { createBatchProcessor } from '../src'

describe('createBatchProcessor', () => {
	it('processes items in chunks across multiple ticks', async () => {
		const seen: number[] = []
		const batch = createBatchProcessor<number>({
			chunkSize: 3,
			worker: (n) => {
				seen.push(n)
			},
			initial: [1, 2, 3, 4, 5, 6, 7],
		})

		const r1 = await batch.tick()
		expect(r1.processed).toBe(3)
		expect(r1.remaining).toBe(4)
		expect(seen).toEqual([1, 2, 3])

		const r2 = await batch.tick()
		expect(r2.processed).toBe(3)
		expect(r2.remaining).toBe(1)

		const r3 = await batch.tick()
		expect(r3.processed).toBe(1)
		expect(r3.remaining).toBe(0)
		expect(batch.done()).toBe(true)
	})

	it('done() is true on an empty batch', () => {
		const batch = createBatchProcessor<number>({ chunkSize: 5, worker: () => {} })
		expect(batch.done()).toBe(true)
		expect(batch.pending()).toBe(0)
	})

	it('fill() replaces the queue', async () => {
		const batch = createBatchProcessor<string>({
			chunkSize: 2,
			worker: () => {},
			initial: ['a', 'b'],
		})
		batch.fill(['x', 'y', 'z'])
		expect(batch.pending()).toBe(3)
		await batch.tick()
		expect(batch.pending()).toBe(1)
	})

	it('enqueue() appends without resetting', async () => {
		const seen: string[] = []
		const batch = createBatchProcessor<string>({
			chunkSize: 2,
			worker: (s) => {
				seen.push(s)
			},
			initial: ['a', 'b'],
		})
		await batch.tick()
		batch.enqueue(['c', 'd'])
		await batch.tick()
		expect(seen).toEqual(['a', 'b', 'c', 'd'])
	})

	it('clear() empties the queue', () => {
		const batch = createBatchProcessor<number>({
			chunkSize: 1,
			worker: () => {},
			initial: [1, 2, 3],
		})
		batch.clear()
		expect(batch.done()).toBe(true)
	})

	it('throws on chunkSize < 1', () => {
		expect(() =>
			createBatchProcessor({ chunkSize: 0, worker: () => {} }),
		).toThrow(/chunkSize/)
	})

	it('awaits async workers', async () => {
		const order: number[] = []
		const batch = createBatchProcessor<number>({
			chunkSize: 2,
			worker: async (n) => {
				await new Promise((r) => setTimeout(r, 1))
				order.push(n)
			},
			initial: [1, 2],
		})
		await batch.tick()
		expect(order).toEqual([1, 2])
	})
})
