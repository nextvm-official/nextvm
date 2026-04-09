import { describe, expect, it } from 'vitest'
import {
	defineRouter,
	procedure,
	RpcError,
	RpcRouter,
	z,
} from '../src'

const bankingRouter = defineRouter({
	getBalance: procedure
		.input(z.object({ accountId: z.string() }))
		.query(({ input }) => ({ accountId: input.accountId, balance: 1234 })),

	transfer: procedure
		.input(z.object({ from: z.string(), to: z.string(), amount: z.number().positive() }))
		.mutation(({ input }) => ({ ok: true, ...input })),

	adminAudit: procedure
		.auth(() => false) // always denies
		.query(() => ({ ok: true })),

	throws: procedure.mutation(() => {
		throw new Error('handler boom')
	}),
})

describe('RpcRouter', () => {
	it('dispatches a registered query', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		const result = await router.dispatch(1, 'banking', 'getBalance', { accountId: '42' })
		expect(result).toEqual({ accountId: '42', balance: 1234 })
	})

	it('throws NOT_FOUND for unknown namespace', async () => {
		const router = new RpcRouter()
		await expect(router.dispatch(1, 'nope', 'foo', {})).rejects.toThrow(
			expect.objectContaining({ code: 'NOT_FOUND' }),
		)
	})

	it('throws NOT_FOUND for unknown procedure in known namespace', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		await expect(router.dispatch(1, 'banking', 'nope', {})).rejects.toThrow(
			expect.objectContaining({ code: 'NOT_FOUND' }),
		)
	})

	it('rejects bad input with VALIDATION_ERROR', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		await expect(
			router.dispatch(1, 'banking', 'transfer', { from: 'a', to: 'b', amount: -5 }),
		).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
	})

	it('blocks denied auth with AUTH_ERROR', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		await expect(router.dispatch(1, 'banking', 'adminAudit', undefined)).rejects.toThrow(
			expect.objectContaining({ code: 'AUTH_ERROR' }),
		)
	})

	it('wraps handler exceptions in INTERNAL_ERROR', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		await expect(router.dispatch(1, 'banking', 'throws', undefined)).rejects.toThrow(
			expect.objectContaining({ code: 'INTERNAL_ERROR' }),
		)
	})

	it('rate limits per player+procedure', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		// Pump 70 calls (default capacity 60); some must fail
		let rateLimited = 0
		for (let i = 0; i < 70; i++) {
			try {
				await router.dispatch(1, 'banking', 'getBalance', { accountId: '1' })
			} catch (err) {
				if (err instanceof RpcError && err.code === 'RATE_LIMITED') rateLimited++
			}
		}
		expect(rateLimited).toBeGreaterThan(0)
	})

	it('injects framework-controlled source into context', async () => {
		const router = new RpcRouter()
		const captured: { source?: number } = {}
		router.register(
			'test',
			defineRouter({
				whoami: procedure.query(({ ctx }) => {
					captured.source = ctx.source
					return ctx.source
				}),
			}),
		)
		await router.dispatch(42, 'test', 'whoami', undefined)
		expect(captured.source).toBe(42)
	})

	it('reports handler errors to the registered reporter', async () => {
		const router = new RpcRouter()
		router.register('banking', bankingRouter)
		const reports: Array<[string, string, unknown]> = []
		router.setErrorReporter((module, proc, err) => reports.push([module, proc, err]))
		await expect(router.dispatch(1, 'banking', 'throws', undefined)).rejects.toBeDefined()
		expect(reports).toHaveLength(1)
		expect(reports[0]?.[0]).toBe('banking')
		expect(reports[0]?.[1]).toBe('throws')
	})
})
