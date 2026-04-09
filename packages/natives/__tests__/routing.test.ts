import { describe, expect, it, vi } from 'vitest'

// Stub the FiveM natives that RoutingService touches.
// The natives package declares these as ambient globals.
;(globalThis as Record<string, unknown>).GetPlayerPed = vi.fn(() => 100)
;(globalThis as Record<string, unknown>).GetVehiclePedIsIn = vi.fn(() => 0)
;(globalThis as Record<string, unknown>).TaskLeaveAnyVehicle = vi.fn()
;(globalThis as Record<string, unknown>).SetPlayerRoutingBucket = vi.fn()
;(globalThis as Record<string, unknown>).SetEntityRoutingBucket = vi.fn()
;(globalThis as Record<string, unknown>).GetEntityRoutingBucket = vi.fn(() => 0)

import { RoutingService } from '../src'

describe('RoutingService', () => {
	it('createInstance assigns a fresh bucket and tracks the instance', () => {
		const routing = new RoutingService()
		const instance = routing.createInstance({ label: 'apartment_42' })
		expect(instance.label).toBe('apartment_42')
		expect(instance.bucketId).toBeGreaterThanOrEqual(1000)
		expect(routing.getInstance(instance.id)).toBe(instance)
	})

	it('movePlayer puts the source into the instance bucket', () => {
		const routing = new RoutingService()
		const instance = routing.createInstance({ label: 'jail' })
		routing.movePlayer(1, instance.id)
		expect(routing.getPlayerBucket(1)).toBe(instance.bucketId)
		expect(instance.players).toContain(1)
	})

	it('resetPlayer puts the source back into bucket 0', () => {
		const routing = new RoutingService()
		const instance = routing.createInstance({ label: 'jail' })
		routing.movePlayer(1, instance.id)
		routing.resetPlayer(1)
		expect(routing.getPlayerBucket(1)).toBe(0)
		expect(instance.players).not.toContain(1)
	})

	it('moving between instances updates membership', () => {
		const routing = new RoutingService()
		const a = routing.createInstance({ label: 'a' })
		const b = routing.createInstance({ label: 'b' })
		routing.movePlayer(1, a.id)
		routing.movePlayer(1, b.id)
		expect(a.players).not.toContain(1)
		expect(b.players).toContain(1)
	})

	it('getPlayersInBucket returns matching sources', () => {
		const routing = new RoutingService()
		const inst = routing.createInstance({ label: 'shared' })
		routing.movePlayer(1, inst.id)
		routing.movePlayer(2, inst.id)
		expect(routing.getPlayersInBucket(inst.bucketId).sort()).toEqual([1, 2])
	})

	it('destroyInstance returns all players to main world', () => {
		const routing = new RoutingService()
		const inst = routing.createInstance({ label: 'gone' })
		routing.movePlayer(1, inst.id)
		routing.movePlayer(2, inst.id)
		routing.destroyInstance(inst.id)
		expect(routing.getInstance(inst.id)).toBeUndefined()
		expect(routing.getPlayerBucket(1)).toBe(0)
		expect(routing.getPlayerBucket(2)).toBe(0)
	})

	it('createInstance with players auto-moves them', () => {
		const routing = new RoutingService()
		const inst = routing.createInstance({ label: 'apt', players: [5, 6] })
		expect(routing.getPlayerBucket(5)).toBe(inst.bucketId)
		expect(routing.getPlayerBucket(6)).toBe(inst.bucketId)
	})

	it('movePlayer to unknown instance throws', () => {
		const routing = new RoutingService()
		expect(() => routing.movePlayer(1, 'nope')).toThrow(/not found/)
	})
})
