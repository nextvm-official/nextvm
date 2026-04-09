import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, ErrorCounter, EventBus, TickScheduler } from '../src'

describe('TickScheduler', () => {
	it('runs registered ticks each frame', async () => {
		const scheduler = new TickScheduler()
		const handler = vi.fn()
		scheduler.register('foo', handler)
		await scheduler.runFrame(0)
		expect(handler).toHaveBeenCalledTimes(1)
	})

	it('respects the per-tick interval gate', async () => {
		const scheduler = new TickScheduler()
		const handler = vi.fn()
		scheduler.register('foo', handler, { interval: 1000 })
		await scheduler.runFrame(0)
		await scheduler.runFrame(500) // too soon
		await scheduler.runFrame(1500) // ok again
		expect(handler).toHaveBeenCalledTimes(2)
	})

	it('skips ticks for degraded modules', async () => {
		const eventBus = new EventBus()
		const counter = new ErrorCounter(1, 60_000) // threshold = 1
		const boundary = new ErrorBoundary(counter, eventBus)
		const scheduler = new TickScheduler()
		scheduler.setErrorBoundary(boundary)

		const handler = vi.fn(() => {
			throw new Error('boom')
		})
		scheduler.register('faulty', handler)

		// First frame: handler runs, throws → boundary records 1 error
		// → counter threshold (1) reached → faulty becomes degraded
		const f1 = await scheduler.runFrame(0)
		expect(handler).toHaveBeenCalledTimes(1)
		expect(f1.executed).toBe(1)
		expect(boundary.isDegraded('faulty')).toBe(true)

		// Second frame: degraded → skipped
		const f2 = await scheduler.runFrame(100)
		expect(f2.skippedDegraded).toBe(1)
		expect(handler).toHaveBeenCalledTimes(1) // still only 1 call
	})

	it('reports tick counts by priority', () => {
		const scheduler = new TickScheduler()
		scheduler.register('foo', () => {}, { priority: 'HIGH' })
		scheduler.register('bar', () => {}, { priority: 'LOW' })
		scheduler.register('baz', () => {}, { priority: 'MEDIUM' })
		expect(scheduler.getTicksByPriority('HIGH')).toHaveLength(1)
		expect(scheduler.getTicksByPriority('MEDIUM')).toHaveLength(1)
		expect(scheduler.getTicksByPriority('LOW')).toHaveLength(1)
	})

	it('unregisterModule removes all of a modules ticks', () => {
		const scheduler = new TickScheduler()
		scheduler.register('foo', () => {})
		scheduler.register('foo', () => {})
		scheduler.register('bar', () => {})
		expect(scheduler.getTickCount()).toBe(3)
		scheduler.unregisterModule('foo')
		expect(scheduler.getTickCount()).toBe(1)
		expect(scheduler.getTickCountForModule('foo')).toBe(0)
	})

	it('runs ticks even without an error boundary configured', async () => {
		const scheduler = new TickScheduler()
		const handler = vi.fn()
		scheduler.register('foo', handler)
		const stats = await scheduler.runFrame(0)
		expect(stats.executed).toBe(1)
	})
})
