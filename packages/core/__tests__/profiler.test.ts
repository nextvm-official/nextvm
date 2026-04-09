import { describe, expect, it, vi } from 'vitest'
import { Profiler } from '../src'

describe('Profiler', () => {
	it('records and aggregates samples', () => {
		const p = new Profiler()
		p.record('tick', 'banking', 'main', 5)
		p.record('tick', 'banking', 'main', 10)
		p.record('tick', 'banking', 'main', 15)
		const stats = p.getStats('tick', 'banking', 'main')
		expect(stats?.count).toBe(3)
		expect(stats?.avg).toBe(10)
		expect(stats?.min).toBe(5)
		expect(stats?.max).toBe(15)
	})

	it('returns null for unknown series', () => {
		const p = new Profiler()
		expect(p.getStats('tick', 'foo', 'bar')).toBeNull()
	})

	it('respects the rolling window size', () => {
		const p = new Profiler(3)
		p.record('tick', 'm', 'h', 1)
		p.record('tick', 'm', 'h', 2)
		p.record('tick', 'm', 'h', 3)
		p.record('tick', 'm', 'h', 4)
		const stats = p.getStats('tick', 'm', 'h')
		expect(stats?.count).toBe(3)
		expect(stats?.min).toBe(2) // 1 was dropped
	})

	it('time() records the duration of a function and returns its value', async () => {
		const p = new Profiler()
		const result = await p.time('rpc', 'banking', 'transfer', () => {
			return 42
		})
		expect(result).toBe(42)
		expect(p.getStats('rpc', 'banking', 'transfer')?.count).toBe(1)
	})

	it('time() records duration even when the function throws', async () => {
		const p = new Profiler()
		await expect(
			p.time('rpc', 'banking', 'fail', () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')
		expect(p.getStats('rpc', 'banking', 'fail')?.count).toBe(1)
	})

	it('getStatsByModule filters to one module', () => {
		const p = new Profiler()
		p.record('tick', 'banking', 'main', 5)
		p.record('tick', 'jobs', 'main', 5)
		const stats = p.getStatsByModule('banking')
		expect(Object.keys(stats)).toEqual(['tick:banking:main'])
	})

	it('reset clears every series', () => {
		const p = new Profiler()
		p.record('tick', 'm', 'h', 1)
		p.reset()
		expect(p.getSeriesCount()).toBe(0)
	})

	it('computes percentiles', () => {
		const p = new Profiler()
		for (let i = 1; i <= 100; i++) p.record('tick', 'm', 'h', i)
		const stats = p.getStats('tick', 'm', 'h')!
		expect(stats.p50).toBeGreaterThanOrEqual(49)
		expect(stats.p50).toBeLessThanOrEqual(51)
		expect(stats.p95).toBeGreaterThanOrEqual(94)
		expect(stats.p99).toBeGreaterThanOrEqual(98)
	})
})
