import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNative } from '../src'

describe('useNative', () => {
	afterEach(() => {
		// Clean up any globals stubbed by individual tests
		delete (globalThis as Record<string, unknown>).GetSomeNumber
	})

	it('invokes a registered global function and returns its value', () => {
		;(globalThis as Record<string, unknown>).GetSomeNumber = vi.fn((a: number, b: number) => a + b)
		const result = useNative<number>('GetSomeNumber', 2, 3)
		expect(result).toBe(5)
	})

	it('throws a clear error when the global is missing', () => {
		expect(() => useNative('NonExistentNative')).toThrow(/NonExistentNative/)
	})

	it('throws when the global exists but is not callable', () => {
		;(globalThis as Record<string, unknown>).NotAFunction = 42
		expect(() => useNative('NotAFunction')).toThrow(/NotAFunction/)
		delete (globalThis as Record<string, unknown>).NotAFunction
	})
})
