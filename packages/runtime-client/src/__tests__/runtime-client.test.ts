import { defineModule } from '@nextvm/core'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapClient } from '../bootstrap'
import { RuntimeRpcTransport } from '../rpc-transport'

const buildModule = (calls: Record<string, unknown[]> = {}) =>
	defineModule({
		name: 'demo',
		version: '0.1.0',
		client: (ctx) => {
			ctx.onMounted(() => {
				;(calls.mounted ??= []).push({})
			})
			ctx.onModuleStop(() => {
				;(calls.stopped ??= []).push({})
			})
			ctx.onTick(() => {
				;(calls.tick ??= []).push(Date.now())
			}, { interval: 0, priority: 'HIGH' })
		},
	})

describe('bootstrapClient', () => {
	it('initializes modules on the client side', async () => {
		const calls: Record<string, unknown[]> = {}
		const runtime = await bootstrapClient({ modules: [buildModule(calls)] })
		expect(runtime.loader.getContainer().getModuleNames()).toEqual(['demo'])
	})

	it('handleMounted fires onMounted hooks', async () => {
		const calls: Record<string, unknown[]> = {}
		const runtime = await bootstrapClient({ modules: [buildModule(calls)] })
		await runtime.handleMounted()
		expect(calls.mounted).toEqual([{}])
	})

	it('runFrame drives the client tick loop', async () => {
		const calls: Record<string, unknown[]> = {}
		const runtime = await bootstrapClient({ modules: [buildModule(calls)] })
		await runtime.runFrame(0)
		expect((calls.tick ?? []).length).toBeGreaterThanOrEqual(1)
	})

	it('stop runs onModuleStop hooks', async () => {
		const calls: Record<string, unknown[]> = {}
		const runtime = await bootstrapClient({ modules: [buildModule(calls)] })
		await runtime.stop()
		expect(calls.stopped).toEqual([{}])
	})

	it('uses the supplied transport', async () => {
		const transport = new RuntimeRpcTransport({
			emit: () => undefined,
			subscribe: () => undefined,
		})
		const runtime = await bootstrapClient({ modules: [buildModule()], transport })
		expect(runtime.transport).toBe(transport)
	})
})

describe('RuntimeRpcTransport', () => {
	it('correlates a request to its response by id', async () => {
		const events: Array<[string, unknown[]]> = []
		let responseHandler: ((...args: unknown[]) => void) | null = null
		const transport = new RuntimeRpcTransport({
			emit: (event, ...args) => events.push([event, args]),
			subscribe: (event, handler) => {
				if (event === '__nextvm:rpc:response') responseHandler = handler
			},
		})
		const promise = transport.call('banking', 'getBalance', { accountId: 'a' })
		expect(events).toHaveLength(1)
		expect(events[0][0]).toBe('__nextvm:rpc')
		const [, [namespace, procedure, input, requestId]] = events[0]
		expect(namespace).toBe('banking')
		expect(procedure).toBe('getBalance')
		expect(input).toEqual({ accountId: 'a' })
		expect(transport.inFlight).toBe(1)

		responseHandler?.(requestId, null, { cash: 500 })
		await expect(promise).resolves.toEqual({ cash: 500 })
		expect(transport.inFlight).toBe(0)
	})

	it('rejects when server responds with an error message', async () => {
		let responseHandler: ((...args: unknown[]) => void) | null = null
		const transport = new RuntimeRpcTransport({
			emit: () => undefined,
			subscribe: (event, handler) => {
				if (event === '__nextvm:rpc:response') responseHandler = handler
			},
		})
		const promise = transport.call('banking', 'fail', undefined)
		responseHandler?.(1, 'boom', null)
		await expect(promise).rejects.toThrow(/boom/)
	})

	it('drops responses for unknown request ids', () => {
		let responseHandler: ((...args: unknown[]) => void) | null = null
		new RuntimeRpcTransport({
			emit: () => undefined,
			subscribe: (event, handler) => {
				if (event === '__nextvm:rpc:response') responseHandler = handler
			},
		})
		expect(() => responseHandler?.(999, null, null)).not.toThrow()
	})

	it('rejects on timeout', async () => {
		vi.useFakeTimers()
		const transport = new RuntimeRpcTransport({
			emit: () => undefined,
			subscribe: () => undefined,
			timeoutMs: 50,
		})
		const promise = transport.call('ns', 'slow', undefined)
		vi.advanceTimersByTime(60)
		await expect(promise).rejects.toThrow(/timed out/)
		vi.useRealTimers()
	})
})
