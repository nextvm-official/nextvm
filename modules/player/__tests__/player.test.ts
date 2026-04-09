import { createModuleHarness } from '@nextvm/test-utils'
import { describe, expect, it } from 'vitest'
import { playerRouter, playerState } from '../src'

let charSeq = 2000

const buildHarness = () => {
	const harness = createModuleHarness({ namespace: 'player', router: playerRouter })
	const charId = ++charSeq
	return { harness, charId }
}

describe('playerState shape', () => {
	it('declares all required fields with descriptions', () => {
		const shape = playerState.schema.shape
		for (const key of ['posX', 'posY', 'posZ', 'health', 'armor', 'isDead']) {
			expect(shape[key]).toBeDefined()
			expect((shape[key] as { _def: { description?: string } })._def.description).toBeTruthy()
		}
	})

	it('clamps health to schema bounds', () => {
		expect(() => playerState.set(99, 'health', -1)).toThrow()
		expect(() => playerState.set(99, 'health', 999)).toThrow()
		playerState.clear(99)
	})
})

describe('player router — getMe', () => {
	it('returns defaults for a fresh character', async () => {
		const { harness, charId } = buildHarness()
		const result = (await harness.dispatch(charId, 'getMe')) as {
			posX: number
			posY: number
			posZ: number
			health: number
			armor: number
			isDead: boolean
		}
		expect(result).toEqual({
			posX: 0,
			posY: 0,
			posZ: 0,
			health: 100,
			armor: 0,
			isDead: false,
		})
	})

	it('NOT_FOUND when no charId', async () => {
		const harness = createModuleHarness({
			namespace: 'player',
			router: playerRouter,
			charIdResolver: () => null,
		})
		await expect(harness.dispatch(1, 'getMe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
})

describe('player router — teleport', () => {
	it('writes pos fields', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'teleport', { x: 100, y: 200, z: 30 })
		expect(playerState.get(charId, 'posX')).toBe(100)
		expect(playerState.get(charId, 'posY')).toBe(200)
		expect(playerState.get(charId, 'posZ')).toBe(30)
	})

	it('rejects non-numeric coords via Zod', async () => {
		const { harness, charId } = buildHarness()
		await expect(
			harness.dispatch(charId, 'teleport', { x: 'a', y: 0, z: 0 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})
})

describe('player router — getPlayer', () => {
	it('returns another character\'s state by charId', async () => {
		const { harness } = buildHarness()
		const target = ++charSeq
		playerState.set(target, 'health', 75)
		const result = (await harness.dispatch(1, 'getPlayer', { charId: target })) as {
			health: number
		}
		expect(result.health).toBe(75)
	})
})

describe('player router — admin revive/setHealth', () => {
	it('revive resets isDead and restores health', async () => {
		const { harness } = buildHarness()
		const target = ++charSeq
		playerState.set(target, 'isDead', true)
		playerState.set(target, 'health', 0)
		await harness.dispatch(1, 'revive', { charId: target })
		expect(playerState.get(target, 'isDead')).toBe(false)
		expect(playerState.get(target, 'health')).toBe(100)
	})

	it('setHealth writes the value', async () => {
		const { harness } = buildHarness()
		const target = ++charSeq
		await harness.dispatch(1, 'setHealth', { charId: target, health: 42 })
		expect(playerState.get(target, 'health')).toBe(42)
	})

	it('setHealth rejects out-of-range', async () => {
		const { harness } = buildHarness()
		await expect(
			harness.dispatch(1, 'setHealth', { charId: 1, health: 999 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})
})
