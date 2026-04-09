import { defineModule } from '@nextvm/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrapClient } from '../bootstrap'

/**
 * Smoke tests for the FiveM client event bridge inside `bootstrapClient`.
 * Mirrors the server-side bridge tests: stub the FiveM client globals,
 * boot the runtime, then fire events and assert the loader saw them.
 */

interface ClientBridgeState {
	listeners: Map<string, Array<(...args: unknown[]) => void>>
	netListeners: Map<string, Array<(...args: unknown[]) => void>>
	emittedNet: Array<{ event: string; args: unknown[] }>
	tickHandlers: Array<() => void>
	clearedTicks: number[]
}

let state: ClientBridgeState

beforeEach(() => {
	state = {
		listeners: new Map(),
		netListeners: new Map(),
		emittedNet: [],
		tickHandlers: [],
		clearedTicks: [],
	}
	vi.stubGlobal('on', (event: string, handler: (...args: unknown[]) => void) => {
		const list = state.listeners.get(event) ?? []
		list.push(handler)
		state.listeners.set(event, list)
	})
	vi.stubGlobal('onNet', (event: string, handler: (...args: unknown[]) => void) => {
		const list = state.netListeners.get(event) ?? []
		list.push(handler)
		state.netListeners.set(event, list)
	})
	vi.stubGlobal('emitNet', (event: string, ...args: unknown[]) => {
		state.emittedNet.push({ event, args })
	})
	vi.stubGlobal('setTick', (handler: () => void) => {
		state.tickHandlers.push(handler)
		return state.tickHandlers.length
	})
	vi.stubGlobal('clearTick', (id: number) => {
		state.clearedTicks.push(id)
	})
	vi.stubGlobal('GetCurrentResourceName', () => 'nextvm-client')
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const fire = (event: string, ...args: unknown[]) => {
	for (const h of state.listeners.get(event) ?? []) h(...args)
}
const flush = () => new Promise((r) => setImmediate(r))

const buildModule = (calls: Record<string, unknown[]>) =>
	defineModule({
		name: 'cli',
		version: '0.1.0',
		client: (ctx) => {
			ctx.onMounted(() => {
				;(calls.mounted ??= []).push({})
			})
			ctx.onModuleStop(() => {
				;(calls.stopped ??= []).push({})
			})
		},
	})

describe('FiveM client event bridge', () => {
	it('attaches playerSpawned + onClientResourceStop + setTick on bootstrap', async () => {
		await bootstrapClient({ modules: [buildModule({})] })
		expect(state.listeners.has('playerSpawned')).toBe(true)
		expect(state.listeners.has('onClientResourceStop')).toBe(true)
		expect(state.tickHandlers).toHaveLength(1)
	})

	it('playerSpawned → onMounted', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapClient({ modules: [buildModule(calls)] })
		fire('playerSpawned')
		await flush()
		expect(calls.mounted).toEqual([{}])
	})

	it('onClientResourceStop for the framework resource → onModuleStop', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapClient({ modules: [buildModule(calls)] })
		fire('onClientResourceStop', 'nextvm-client')
		await flush()
		expect(state.clearedTicks).toEqual([1])
		expect(calls.stopped).toEqual([{}])
	})

	it('onClientResourceStop for another resource is ignored', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapClient({ modules: [buildModule(calls)] })
		fire('onClientResourceStop', 'unrelated')
		await flush()
		expect(state.clearedTicks).toEqual([])
		expect(calls.stopped).toBeUndefined()
	})

	it('setTick callback drives the tick scheduler', async () => {
		const calls: Record<string, unknown[]> = {}
		const tickModule = defineModule({
			name: 'ticker',
			version: '0.1.0',
			client: (ctx) => {
				ctx.onTick(
					() => {
						;(calls.tick ??= []).push(Date.now())
					},
					{ interval: 0, priority: 'HIGH' },
				)
			},
		})
		await bootstrapClient({ modules: [tickModule] })
		state.tickHandlers[0]?.()
		await flush()
		expect((calls.tick ?? []).length).toBeGreaterThanOrEqual(1)
	})

	it('auto-wired transport calls emitNet on call()', async () => {
		const runtime = await bootstrapClient({ modules: [buildModule({})] })
		const promise = runtime.transport.call('banking', 'getMyBalance', undefined)
		// Don't await — we just want to assert the wire fired
		expect(state.emittedNet).toHaveLength(1)
		expect(state.emittedNet[0].event).toBe('__nextvm:rpc')
		// Resolve the pending promise so the test cleans up
		const responseListeners = state.netListeners.get('__nextvm:rpc:response')
		const requestId = state.emittedNet[0].args[3]
		responseListeners?.[0]?.(requestId, null, { cash: 0 })
		await expect(promise).resolves.toEqual({ cash: 0 })
	})
})
