import { describe, expect, it } from 'vitest'
import { BankingService } from '../src'

describe('BankingService', () => {
	it('seeds and reads balances per character', () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100, bank: 200 })
		expect(svc.get(1)).toEqual({ cash: 100, bank: 200 })
		expect(svc.get(99)).toEqual({ cash: 0, bank: 0 })
	})

	it('addMoney increases the chosen account', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100, bank: 0 })
		const next = await svc.addMoney(1, 'cash', 50)
		expect(next).toBe(150)
		expect(svc.get(1).cash).toBe(150)
	})

	it('addMoney rejects non-positive amounts', async () => {
		const svc = new BankingService()
		await expect(svc.addMoney(1, 'cash', 0)).rejects.toThrow(/positive/)
		await expect(svc.addMoney(1, 'cash', -5)).rejects.toThrow(/positive/)
	})

	it('removeMoney decreases the balance and refuses overdraft', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100, bank: 0 })
		await svc.removeMoney(1, 'cash', 60)
		expect(svc.get(1).cash).toBe(40)
		await expect(svc.removeMoney(1, 'cash', 100)).rejects.toThrow('INSUFFICIENT_FUNDS')
	})

	it('transfer moves money between two characters', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100, bank: 0 })
		svc.seed(2, { cash: 0, bank: 0 })
		const result = await svc.transfer(1, 2, 'cash', 70)
		expect(result.txId).toBeGreaterThan(0)
		expect(svc.get(1).cash).toBe(30)
		expect(svc.get(2).cash).toBe(70)
	})

	it('transfer refuses self', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100, bank: 0 })
		await expect(svc.transfer(1, 1, 'cash', 10)).rejects.toThrow(/self/)
	})

	it('transfer surfaces INSUFFICIENT_FUNDS without mutating either side', async () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 10, bank: 0 })
		svc.seed(2, { cash: 0, bank: 0 })
		await expect(svc.transfer(1, 2, 'cash', 50)).rejects.toThrow('INSUFFICIENT_FUNDS')
		expect(svc.get(1).cash).toBe(10)
		expect(svc.get(2).cash).toBe(0)
	})

	it('clear() drops all balances', () => {
		const svc = new BankingService()
		svc.seed(1, { cash: 100 })
		svc.clear()
		expect(svc.get(1)).toEqual({ cash: 0, bank: 0 })
	})
})
