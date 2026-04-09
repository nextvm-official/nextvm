import { describe, expect, it, vi } from 'vitest'
import {
	defineRouter,
	procedure,
	Profiler,
	RpcRouter,
	TickScheduler,
	z,
} from '../src'

describe('Profiler ↔ TickScheduler integration', () => {
	it('records a tick sample per executed handler', async () => {
		const profiler = new Profiler()
		const scheduler = new TickScheduler()
		scheduler.setProfiler(profiler)
		scheduler.register('banking', () => {
			// burn a tiny bit of time so the sample is non-zero
			let n = 0
			for (let i = 0; i < 1000; i++) n += i
		})
		await scheduler.runFrame(0)
		const stats = profiler.getStats('tick', 'banking', 'onTick')
		expect(stats).not.toBeNull()
		expect(stats?.count).toBe(1)
	})

	it('does not crash when profiler is unset', async () => {
		const scheduler = new TickScheduler()
		const handler = vi.fn()
		scheduler.register('foo', handler)
		await scheduler.runFrame(0)
		expect(handler).toHaveBeenCalledTimes(1)
	})
})

describe('Profiler ↔ RpcRouter integration', () => {
	const router = defineRouter({
		ping: procedure.query(() => 'pong'),
		fail: procedure.mutation(() => {
			throw new Error('boom')
		}),
	})

	it('records an RPC sample on success', async () => {
		const profiler = new Profiler()
		const rpc = new RpcRouter()
		rpc.setProfiler(profiler)
		rpc.register('test', router)
		await rpc.dispatch(1, 'test', 'ping', undefined)
		const stats = profiler.getStats('rpc', 'test', 'ping')
		expect(stats?.count).toBe(1)
	})

	it('records an RPC sample even when the handler throws', async () => {
		const profiler = new Profiler()
		const rpc = new RpcRouter()
		rpc.setProfiler(profiler)
		rpc.register('test', router)
		await expect(rpc.dispatch(1, 'test', 'fail', undefined)).rejects.toBeDefined()
		const stats = profiler.getStats('rpc', 'test', 'fail')
		expect(stats?.count).toBe(1)
	})
})
