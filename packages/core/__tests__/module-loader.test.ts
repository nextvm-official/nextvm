import { describe, expect, it, vi } from 'vitest'
import { defineModule, ModuleLoader, z } from '../src'

describe('ModuleLoader', () => {
	it('initializes modules in dependency order', async () => {
		const loader = new ModuleLoader()
		const calls: string[] = []
		loader.register(
			defineModule({
				name: 'banking',
				version: '1.0',
				dependencies: ['player'],
				server: () => {
					calls.push('banking')
				},
			}),
		)
		loader.register(
			defineModule({
				name: 'player',
				version: '1.0',
				server: () => {
					calls.push('player')
				},
			}),
		)
		await loader.initialize('server')
		expect(calls).toEqual(['player', 'banking'])
	})

	it('validates module config with Zod', async () => {
		const loader = new ModuleLoader()
		loader.register(
			defineModule({
				name: 'broken',
				version: '1.0',
				config: z.object({
					required: z.string(), // no default → fails on empty config
				}),
				server: () => {},
			}),
		)
		await expect(loader.initialize('server')).rejects.toThrow(/validation failed/)
	})

	it('runs lifecycle hooks (onModuleInit + onModuleReady) in order', async () => {
		const loader = new ModuleLoader()
		const calls: string[] = []
		loader.register(
			defineModule({
				name: 'foo',
				version: '1.0',
				server: (ctx) => {
					ctx.onModuleInit(() => {
						calls.push('init')
					})
					ctx.onModuleReady(() => {
						calls.push('ready')
					})
				},
			}),
		)
		await loader.initialize('server')
		expect(calls).toEqual(['init', 'ready'])
	})

	it('isolates lifecycle errors via error boundary (does not fail init)', async () => {
		const loader = new ModuleLoader()
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		loader.register(
			defineModule({
				name: 'foo',
				version: '1.0',
				server: (ctx) => {
					ctx.onModuleInit(() => {
						throw new Error('init boom')
					})
				},
			}),
		)
		// Should NOT throw — error is caught + logged
		await expect(loader.initialize('server')).resolves.toBeUndefined()
		errorSpy.mockRestore()
	})

	it('inject() returns a registered module exports', async () => {
		const loader = new ModuleLoader()
		const container = loader.getContainer()
		container.setResolved('player', { greet: () => 'hi' })
		expect(container.inject<{ greet: () => string }>('player').greet()).toBe('hi')
	})

	it('events bus is shared across modules', async () => {
		const loader = new ModuleLoader()
		const received: string[] = []
		loader.register(
			defineModule({
				name: 'banking',
				version: '1.0',
				server: (ctx) => {
					ctx.onModuleReady(() => {
						ctx.events.emit('banking:ready', 'hi')
					})
				},
			}),
		)
		loader.register(
			defineModule({
				name: 'player',
				version: '1.0',
				server: (ctx) => {
					ctx.events.on('banking:ready', (data) => {
						received.push(String(data))
					})
				},
			}),
		)
		await loader.initialize('server')
		expect(received).toEqual(['hi'])
	})
})
