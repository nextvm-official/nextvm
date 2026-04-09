import { defineModule, defineRouter, procedure } from '@nextvm/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrapServer } from '../bootstrap'

/**
 * Smoke tests for the FXServer event bridge inside `bootstrapServer`.
 * The "happy" tests in bootstrap.test.ts drive the runtime through the
 * exposed `RuntimeHandle` methods. These tests instead stub the FiveM
 * globals (`on`, `onNet`, `emitNet`, `setTick`, `clearTick`,
 * `GetCurrentResourceName`, `GetNumPlayerIdentifiers`,
 * `GetPlayerIdentifier`) and assert that bootstrap actually wires the
 * lifecycle events into the loader. This locks down the bridge code
 * that would otherwise only be exercised in a real FXServer.
 */

interface BridgeState {
	listeners: Map<string, Array<(...args: unknown[]) => void>>
	netListeners: Map<string, Array<(...args: unknown[]) => void>>
	emittedNet: Array<{ event: string; target: number; args: unknown[] }>
	tickHandlers: Array<() => void>
	clearedTicks: number[]
	currentSource: number
}

let state: BridgeState

beforeEach(() => {
	state = {
		listeners: new Map(),
		netListeners: new Map(),
		emittedNet: [],
		tickHandlers: [],
		clearedTicks: [],
		currentSource: 0,
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
	vi.stubGlobal('emitNet', (event: string, target: number, ...args: unknown[]) => {
		state.emittedNet.push({ event, target, args })
	})
	vi.stubGlobal('setTick', (handler: () => void) => {
		state.tickHandlers.push(handler)
		return state.tickHandlers.length
	})
	vi.stubGlobal('clearTick', (id: number) => {
		state.clearedTicks.push(id)
	})
	vi.stubGlobal('GetCurrentResourceName', () => 'nextvm-test-resource')
	// Player identifier stubs — drive `source` via `state.currentSource`.
	vi.stubGlobal('GetNumPlayerIdentifiers', (src: string) =>
		Number(src) === state.currentSource ? 1 : 0,
	)
	vi.stubGlobal('GetPlayerIdentifier', (src: string, _idx: number) =>
		Number(src) === state.currentSource ? `license:player-${src}` : undefined,
	)
	// `source` is set per-event by FiveM — we mutate the global between dispatches.
	Object.defineProperty(globalThis, 'source', {
		get: () => state.currentSource,
		configurable: true,
	})
})

afterEach(() => {
	vi.unstubAllGlobals()
	delete (globalThis as { source?: number }).source
})

const fire = (event: string, ...args: unknown[]) => {
	const handlers = state.listeners.get(event) ?? []
	for (const h of handlers) h(...args)
}
const fireNet = (event: string, ...args: unknown[]) => {
	const handlers = state.netListeners.get(event) ?? []
	for (const h of handlers) h(...args)
}
const flush = () => new Promise((r) => setImmediate(r))

const buildModule = (calls: Record<string, unknown[]>) =>
	defineModule({
		name: 'bridge',
		version: '0.1.0',
		server: (ctx) => {
			ctx.exposeRouter(
				defineRouter({
					ping: procedure.query(() => ({ pong: 1 })),
				}),
			)
			ctx.onPlayerConnecting((name, _d, src) => {
				;(calls.connecting ??= []).push({ name, src })
			})
			ctx.onPlayerDropped((player, reason) => {
				;(calls.dropped ??= []).push({ player, reason })
			})
			ctx.onModuleStop(() => {
				;(calls.stopped ??= []).push({})
			})
		},
	})

describe('FXServer event bridge', () => {
	it('attaches the listed FiveM events on bootstrap', async () => {
		await bootstrapServer({ modules: [buildModule({})] })
		expect(state.listeners.has('playerConnecting')).toBe(true)
		expect(state.listeners.has('playerJoining')).toBe(true)
		expect(state.listeners.has('playerDropped')).toBe(true)
		expect(state.listeners.has('onResourceStop')).toBe(true)
		expect(state.netListeners.has('__nextvm:rpc')).toBe(true)
		expect(state.tickHandlers).toHaveLength(1)
	})

	it('forwards playerConnecting → onPlayerConnecting', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapServer({ modules: [buildModule(calls)] })
		state.currentSource = 5
		fire('playerConnecting', 'Tom')
		await flush()
		expect(calls.connecting).toEqual([{ name: 'Tom', src: 5 }])
	})

	it('forwards playerDropped → onPlayerDropped (with no character → no event)', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapServer({ modules: [buildModule(calls)] })
		state.currentSource = 5
		fire('playerConnecting', 'Tom')
		await flush()
		state.currentSource = 5
		fire('playerDropped', 'kicked')
		await flush()
		// No character was selected → no dropped event but no crash
		expect(calls.dropped).toBeUndefined()
	})

	it('routes __nextvm:rpc → dispatchRpc → emitNet response', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapServer({ modules: [buildModule(calls)] })
		state.currentSource = 7
		fireNet('__nextvm:rpc', 'bridge', 'ping', undefined, 42)
		await flush()
		await flush()
		const sent = state.emittedNet.find((m) => m.event === '__nextvm:rpc:response')
		expect(sent).toBeDefined()
		expect(sent?.target).toBe(7)
		expect(sent?.args[0]).toBe(42)
		expect(sent?.args[1]).toBeNull()
		expect(sent?.args[2]).toEqual({ pong: 1 })
	})

	it('emits an error response for unknown rpc namespaces', async () => {
		await bootstrapServer({ modules: [buildModule({})] })
		state.currentSource = 8
		fireNet('__nextvm:rpc', 'unknown', 'whatever', null, 99)
		await flush()
		await flush()
		const sent = state.emittedNet.find((m) => m.event === '__nextvm:rpc:response')
		expect(sent?.args[0]).toBe(99)
		expect(sent?.args[1]).toMatch(/not found/i)
		expect(sent?.args[2]).toBeNull()
	})

	it('runs the tick handler on each setTick callback invocation', async () => {
		const ticks: number[] = []
		const tickModule = defineModule({
			name: 'ticker',
			version: '0.1.0',
			server: (ctx) => {
				ctx.onTick(
					() => {
						ticks.push(Date.now())
					},
					{ interval: 0, priority: 'HIGH' },
				)
			},
		})
		await bootstrapServer({ modules: [tickModule] })
		expect(state.tickHandlers).toHaveLength(1)
		state.tickHandlers[0]?.()
		await flush()
		expect(ticks.length).toBeGreaterThanOrEqual(1)
	})

	it('onResourceStop for the framework resource clears the tick + runs onModuleStop', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapServer({ modules: [buildModule(calls)] })
		fire('onResourceStop', 'nextvm-test-resource')
		await flush()
		expect(state.clearedTicks).toEqual([1])
		expect(calls.stopped).toEqual([{}])
	})

	it('onResourceStop for a different resource is ignored', async () => {
		const calls: Record<string, unknown[]> = {}
		await bootstrapServer({ modules: [buildModule(calls)] })
		fire('onResourceStop', 'some-other-resource')
		await flush()
		expect(state.clearedTicks).toEqual([])
		expect(calls.stopped).toBeUndefined()
	})
})
