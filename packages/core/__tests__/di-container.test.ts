import { describe, expect, it } from 'vitest'
import { defineModule, DIContainer } from '../src'

describe('DIContainer', () => {
	it('registers and resolves modules in topological order', () => {
		const c = new DIContainer()
		c.register(
			defineModule({
				name: 'banking',
				version: '1.0',
				dependencies: ['player'],
				server: () => {},
			}),
		)
		c.register(defineModule({ name: 'player', version: '1.0', server: () => {} }))

		const order = c.resolveDependencyOrder()
		expect(order.indexOf('player')).toBeLessThan(order.indexOf('banking'))
	})

	it('detects circular dependencies and throws with both names', () => {
		const c = new DIContainer()
		c.register(
			defineModule({ name: 'a', version: '1.0', dependencies: ['b'], server: () => {} }),
		)
		c.register(
			defineModule({ name: 'b', version: '1.0', dependencies: ['a'], server: () => {} }),
		)

		expect(() => c.resolveDependencyOrder()).toThrow(/Circular dependency/)
	})

	it('rejects duplicate module registration', () => {
		const c = new DIContainer()
		const mod = defineModule({ name: 'foo', version: '1.0', server: () => {} })
		c.register(mod)
		expect(() => c.register(mod)).toThrow(/already registered/)
	})

	it('throws on unknown dependency with helpful list', () => {
		const c = new DIContainer()
		c.register(
			defineModule({
				name: 'banking',
				version: '1.0',
				dependencies: ['nonexistent'],
				server: () => {},
			}),
		)
		expect(() => c.resolveDependencyOrder()).toThrow(/'nonexistent' is not registered/)
	})

	it('handles modules with no dependencies', () => {
		const c = new DIContainer()
		c.register(defineModule({ name: 'standalone', version: '1.0', server: () => {} }))
		expect(c.resolveDependencyOrder()).toEqual(['standalone'])
	})

	it('reports module presence via has()', () => {
		const c = new DIContainer()
		c.register(defineModule({ name: 'foo', version: '1.0', server: () => {} }))
		expect(c.has('foo')).toBe(true)
		expect(c.has('bar')).toBe(false)
	})
})
