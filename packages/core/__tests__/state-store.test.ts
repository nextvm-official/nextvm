import { describe, expect, it, vi } from 'vitest'
import { defineState, z } from '../src'

const buildPlayerState = () =>
	defineState('player', {
		cash: z.number().default(0),
		bank: z.number().default(500),
		job: z.string().default('unemployed'),
	})

describe('StateStore', () => {
	it('returns schema defaults when no value set', () => {
		const state = buildPlayerState()
		expect(state.get(1, 'cash')).toBe(0)
		expect(state.get(1, 'bank')).toBe(500)
		expect(state.get(1, 'job')).toBe('unemployed')
	})

	it('persists values per character', () => {
		const state = buildPlayerState()
		state.set(1, 'cash', 100)
		state.set(2, 'cash', 200)
		expect(state.get(1, 'cash')).toBe(100)
		expect(state.get(2, 'cash')).toBe(200)
	})

	it('validates writes against the schema', () => {
		const state = buildPlayerState()
		// @ts-expect-error — testing runtime validation
		expect(() => state.set(1, 'cash', 'not a number')).toThrow(/validation failed/)
	})

	it('increment updates numeric fields', () => {
		const state = buildPlayerState()
		state.set(1, 'cash', 100)
		const next = state.increment(1, 'cash', 50)
		expect(next).toBe(150)
		expect(state.get(1, 'cash')).toBe(150)
	})

	it('increment refuses non-numeric fields', () => {
		const state = buildPlayerState()
		expect(() => state.increment(1, 'job', 1)).toThrow(/not numeric/)
	})

	it('subscribers fire on change with old + new value', () => {
		const state = buildPlayerState()
		state.set(1, 'cash', 100)
		const cb = vi.fn()
		state.subscribe(1, 'cash', cb)
		state.set(1, 'cash', 200)
		expect(cb).toHaveBeenCalledWith(200, 100)
	})

	it('unsubscribe stops further callbacks', () => {
		const state = buildPlayerState()
		const cb = vi.fn()
		const off = state.subscribe(1, 'cash', cb)
		state.set(1, 'cash', 100)
		off()
		state.set(1, 'cash', 200)
		expect(cb).toHaveBeenCalledTimes(1)
	})

	it('clear removes a character entirely', () => {
		const state = buildPlayerState()
		state.set(1, 'cash', 999)
		state.clear(1)
		expect(state.get(1, 'cash')).toBe(0) // back to default
	})

	it('serialize/deserialize round-trips state', () => {
		const a = buildPlayerState()
		a.set(1, 'cash', 100)
		a.set(1, 'job', 'police')
		a.set(2, 'cash', 50)
		const snapshot = a.serialize()

		const b = buildPlayerState()
		b.deserialize(snapshot)
		expect(b.get(1, 'cash')).toBe(100)
		expect(b.get(1, 'job')).toBe('police')
		expect(b.get(2, 'cash')).toBe(50)
	})

	it('getAll returns the full character state object', () => {
		const state = buildPlayerState()
		state.set(1, 'cash', 100)
		state.set(1, 'job', 'police')
		expect(state.getAll(1)).toEqual({ cash: 100, bank: 500, job: 'police' })
	})

	it('loadAll validates the entire payload', () => {
		const state = buildPlayerState()
		state.loadAll(1, { cash: 5, bank: 10, job: 'taxi' })
		expect(state.get(1, 'cash')).toBe(5)
		expect(() =>
			// @ts-expect-error — testing runtime validation
			state.loadAll(1, { cash: 'no', bank: 10, job: 'taxi' }),
		).toThrow(/validation failed/)
	})
})
