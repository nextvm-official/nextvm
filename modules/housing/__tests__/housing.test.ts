import { RoutingService } from '@nextvm/natives'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	type BankingAdapter,
	defineProperty,
	HousingService,
	housingState,
	PropertyRegistry,
} from '../src'

// Stub the FiveM globals RoutingService touches
;(globalThis as Record<string, unknown>).GetPlayerPed = vi.fn(() => 100)
;(globalThis as Record<string, unknown>).GetVehiclePedIsIn = vi.fn(() => 0)
;(globalThis as Record<string, unknown>).TaskLeaveAnyVehicle = vi.fn()
;(globalThis as Record<string, unknown>).SetPlayerRoutingBucket = vi.fn()
;(globalThis as Record<string, unknown>).SetEntityRoutingBucket = vi.fn()
;(globalThis as Record<string, unknown>).GetEntityRoutingBucket = vi.fn(() => 0)

const buildRegistry = () => {
	const reg = new PropertyRegistry()
	reg.define(
		defineProperty({
			id: 'apt_test',
			label: 'Test Apartment',
			type: 'apartment',
			entrance: { x: 0, y: 0, z: 0 },
			price: 100_000,
			maxOccupants: 4,
		}),
	)
	reg.define(
		defineProperty({
			id: 'house_test',
			label: 'Test House',
			type: 'house',
			entrance: { x: 100, y: 100, z: 0 },
			price: 500_000,
			maxOccupants: 8,
		}),
	)
	return reg
}

const buildBanking = (initialBank = 1_000_000): BankingAdapter => ({
	removeMoney: vi.fn(async (_charId, _type, amount) => {
		if (amount > initialBank) throw new Error('INSUFFICIENT_FUNDS')
		return initialBank - amount
	}),
})

describe('PropertyRegistry', () => {
	it('returns nothing for an empty radius search', () => {
		const reg = buildRegistry()
		expect(reg.findNearby({ x: 1000, y: 1000, z: 0 }, 1)).toEqual([])
	})

	it('finds properties within the radius', () => {
		const reg = buildRegistry()
		const found = reg.findNearby({ x: 0, y: 0, z: 0 }, 10)
		expect(found.map((p) => p.id)).toEqual(['apt_test'])
	})
})

describe('HousingService', () => {
	beforeEach(() => {
		// housingState is a module-level singleton — clear test character
		// state between tests so they don't leak ownership.
		housingState.clear(1)
		housingState.clear(2)
	})

	it('purchase debits banking and adds to ownership', async () => {
		const banking = buildBanking()
		const service = new HousingService(buildRegistry(), new RoutingService(), banking)
		const prop = await service.purchase(1, 'apt_test')
		expect(prop.id).toBe('apt_test')
		expect(banking.removeMoney).toHaveBeenCalledWith(1, 'bank', 100_000, 'housing:apt_test')
		expect(service.getOwned(1).map((p) => p.id)).toEqual(['apt_test'])
	})

	it('purchase rejects unknown property', async () => {
		const service = new HousingService(buildRegistry(), new RoutingService(), buildBanking())
		await expect(service.purchase(1, 'nope')).rejects.toThrow('UNKNOWN_PROPERTY')
	})

	it('purchase rejects already-owned', async () => {
		const banking = buildBanking()
		const service = new HousingService(buildRegistry(), new RoutingService(), banking)
		await service.purchase(1, 'apt_test')
		await expect(service.purchase(1, 'apt_test')).rejects.toThrow('ALREADY_OWNED')
	})

	it('purchase rejects when banking is not configured', async () => {
		const service = new HousingService(buildRegistry(), new RoutingService())
		await expect(service.purchase(1, 'apt_test')).rejects.toThrow('BANKING_UNAVAILABLE')
	})

	it('enter creates a routing instance for the owner', async () => {
		const service = new HousingService(buildRegistry(), new RoutingService(), buildBanking())
		await service.purchase(1, 'apt_test')
		const result = service.enter(1, 1, 'apt_test')
		expect(result.instanceId).toMatch(/^instance_\d+_housing_apt_test_1$/)
	})

	it('enter rejects non-owners', () => {
		const service = new HousingService(buildRegistry(), new RoutingService(), buildBanking())
		expect(() => service.enter(2, 2, 'apt_test')).toThrow('NOT_OWNER')
	})
})
