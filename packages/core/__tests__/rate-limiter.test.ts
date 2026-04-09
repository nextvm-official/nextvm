import { describe, expect, it, vi } from 'vitest'
import { RateLimiter } from '../src'

describe('RateLimiter', () => {
	it('allows requests within capacity', () => {
		const rl = new RateLimiter(5, 1)
		for (let i = 0; i < 5; i++) {
			expect(rl.tryConsume(1, 'banking.transfer')).toBe(true)
		}
	})

	it('rejects requests when bucket is empty', () => {
		const rl = new RateLimiter(2, 0)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(false)
	})

	it('refills tokens over time', () => {
		vi.useFakeTimers()
		const rl = new RateLimiter(2, 2) // 2 tokens/sec
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(false)
		vi.advanceTimersByTime(1000) // +2 tokens
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		vi.useRealTimers()
	})

	it('isolates buckets by player', () => {
		const rl = new RateLimiter(1, 0)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(2, 'foo')).toBe(true) // different player
		expect(rl.tryConsume(1, 'foo')).toBe(false)
	})

	it('isolates buckets by procedure', () => {
		const rl = new RateLimiter(1, 0)
		expect(rl.tryConsume(1, 'foo')).toBe(true)
		expect(rl.tryConsume(1, 'bar')).toBe(true)
		expect(rl.tryConsume(1, 'foo')).toBe(false)
	})

	it('clearPlayer wipes only that player', () => {
		const rl = new RateLimiter(1, 0)
		rl.tryConsume(1, 'foo')
		rl.tryConsume(2, 'foo')
		rl.clearPlayer(1)
		expect(rl.tryConsume(1, 'foo')).toBe(true) // refilled for player 1
		expect(rl.tryConsume(2, 'foo')).toBe(false) // player 2 still empty
	})
})
