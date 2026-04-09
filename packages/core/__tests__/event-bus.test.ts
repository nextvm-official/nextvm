import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../src'

describe('EventBus', () => {
	it('delivers events to all subscribers', () => {
		const bus = new EventBus()
		const a = vi.fn()
		const b = vi.fn()
		bus.on('test', a)
		bus.on('test', b)
		bus.emit('test', { value: 1 })
		expect(a).toHaveBeenCalledWith({ value: 1 })
		expect(b).toHaveBeenCalledWith({ value: 1 })
	})

	it('allows unsubscribe', () => {
		const bus = new EventBus()
		const handler = vi.fn()
		bus.on('test', handler)
		bus.off('test', handler)
		bus.emit('test', null)
		expect(handler).not.toHaveBeenCalled()
	})

	it('keeps other handlers running when one throws', () => {
		const bus = new EventBus()
		const broken = vi.fn(() => {
			throw new Error('boom')
		})
		const ok = vi.fn()
		bus.on('test', broken)
		bus.on('test', ok)
		// Should not throw — error is reported, other handler still runs
		expect(() => bus.emit('test', null)).not.toThrow()
		expect(ok).toHaveBeenCalled()
	})

	it('routes errors to the error reporter when set', () => {
		const bus = new EventBus()
		const reporter = vi.fn()
		bus.setErrorReporter(reporter)
		bus.onFromModule(
			'test',
			() => {
				throw new Error('boom')
			},
			'banking',
		)
		bus.emit('test', null)
		expect(reporter).toHaveBeenCalledWith('banking', 'test', expect.any(Error))
	})

	it('reports null module attribution for unattributed handlers', () => {
		const bus = new EventBus()
		const reporter = vi.fn()
		bus.setErrorReporter(reporter)
		bus.on('test', () => {
			throw new Error('boom')
		})
		bus.emit('test', null)
		expect(reporter).toHaveBeenCalledWith(null, 'test', expect.any(Error))
	})

	it('reports listener counts', () => {
		const bus = new EventBus()
		bus.on('test', () => {})
		bus.on('test', () => {})
		expect(bus.listenerCount('test')).toBe(2)
		expect(bus.listenerCount('other')).toBe(0)
	})

	it('removeAllListeners clears subscriptions for an event', () => {
		const bus = new EventBus()
		const handler = vi.fn()
		bus.on('test', handler)
		bus.removeAllListeners('test')
		bus.emit('test', null)
		expect(handler).not.toHaveBeenCalled()
	})
})
