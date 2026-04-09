import { createModuleHarness } from '@nextvm/test-utils'
import { describe, expect, it } from 'vitest'
import { BankingService, buildBankingRouter } from '../src'

const buildHarness = () => {
	const svc = new BankingService()
	const harness = createModuleHarness({
		namespace: 'banking',
		router: buildBankingRouter(svc),
	})
	return { svc, harness }
}

describe('banking router', () => {
	it('getMyBalance returns the calling character balance', async () => {
		const { svc, harness } = buildHarness()
		svc.seed(1, { cash: 100, bank: 200 })
		const result = await harness.dispatch(1, 'getMyBalance')
		expect(result).toEqual({ cash: 100, bank: 200 })
	})

	it('transfer between two characters succeeds', async () => {
		const { svc, harness } = buildHarness()
		svc.seed(1, { cash: 500, bank: 0 })
		svc.seed(2, { cash: 0, bank: 0 })
		const result = await harness.dispatch(1, 'transfer', {
			toCharId: 2,
			type: 'cash',
			amount: 200,
			reason: 'rent',
		})
		expect((result as { txId: number }).txId).toBeGreaterThan(0)
		expect(svc.get(1).cash).toBe(300)
		expect(svc.get(2).cash).toBe(200)
	})

	it('transfer with insufficient funds returns VALIDATION_ERROR', async () => {
		const { svc, harness } = buildHarness()
		svc.seed(1, { cash: 50, bank: 0 })
		await expect(
			harness.dispatch(1, 'transfer', { toCharId: 2, type: 'cash', amount: 100 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('addMoney admin path credits a character', async () => {
		const { svc, harness } = buildHarness()
		svc.seed(2, { cash: 0, bank: 100 })
		const result = await harness.dispatch(99, 'addMoney', {
			charId: 2,
			type: 'bank',
			amount: 500,
		})
		expect((result as { ok: boolean; balance: number }).balance).toBe(600)
	})

	it('removeMoney admin path debits, surfacing insufficient funds', async () => {
		const { svc, harness } = buildHarness()
		svc.seed(2, { cash: 50, bank: 0 })
		await expect(
			harness.dispatch(99, 'removeMoney', {
				charId: 2,
				type: 'cash',
				amount: 100,
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('rejects negative amounts via Zod', async () => {
		const { harness } = buildHarness()
		await expect(
			harness.dispatch(1, 'addMoney', { charId: 2, type: 'cash', amount: -5 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})
})
