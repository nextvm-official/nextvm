import { describe, expect, it, vi } from 'vitest'
import { ErrorCounter } from '../src'

const makeError = (overrides: Partial<{ message: string; handler: string }> = {}) => ({
	origin: 'lifecycle' as const,
	handler: overrides.handler ?? 'onModuleInit',
	message: overrides.message ?? 'boom',
	timestamp: Date.now(),
})

describe('ErrorCounter', () => {
	it('tracks errors per module', () => {
		const counter = new ErrorCounter(10, 60_000)
		counter.record('banking', makeError())
		counter.record('banking', makeError())
		expect(counter.getStatus('banking').errorCount).toBe(2)
		expect(counter.isDegraded('banking')).toBe(false)
	})

	it('triggers degradation when threshold exceeded', () => {
		const counter = new ErrorCounter(3, 60_000)
		const a = counter.record('foo', makeError())
		const b = counter.record('foo', makeError())
		const c = counter.record('foo', makeError())
		expect(a).toBe(false)
		expect(b).toBe(false)
		expect(c).toBe(true) // 3rd error → just degraded
		expect(counter.isDegraded('foo')).toBe(true)
	})

	it('does not double-trigger degradation', () => {
		const counter = new ErrorCounter(2, 60_000)
		counter.record('foo', makeError())
		const trigger = counter.record('foo', makeError())
		const followup = counter.record('foo', makeError())
		expect(trigger).toBe(true)
		expect(followup).toBe(false) // already degraded
	})

	it('drops errors outside the rolling window', () => {
		vi.useFakeTimers()
		const counter = new ErrorCounter(10, 1000)
		counter.record('foo', { ...makeError(), timestamp: Date.now() })
		// advance past the window
		vi.advanceTimersByTime(2000)
		counter.record('foo', { ...makeError(), timestamp: Date.now() })
		// only the second error should remain in the window
		expect(counter.getStatus('foo').errorCount).toBe(1)
		vi.useRealTimers()
	})

	it('reEnable resets the degraded flag and clears history', () => {
		const counter = new ErrorCounter(2, 60_000)
		counter.record('foo', makeError())
		counter.record('foo', makeError())
		expect(counter.isDegraded('foo')).toBe(true)
		counter.reEnable('foo')
		expect(counter.isDegraded('foo')).toBe(false)
		expect(counter.getStatus('foo').errorCount).toBe(0)
	})
})
