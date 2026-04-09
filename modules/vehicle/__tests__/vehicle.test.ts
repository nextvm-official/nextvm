import { createModuleHarness } from '@nextvm/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Stub the FiveM globals before the vehicle module imports them.
let nextHandle = 1000
let nextNetId = 5000
beforeAll(() => {
	vi.stubGlobal('CreateVehicleServerSetter', () => ++nextHandle)
	vi.stubGlobal('NetworkGetNetworkIdFromEntity', (_h: number) => ++nextNetId)
})

// Lazy-load after stubs are installed.
const loadModule = async () => {
	const mod = await import('../src')
	return mod
}

let charSeq = 3000

describe('vehicleState shape', () => {
	it('has ownedNetIds field with describe()', async () => {
		const { vehicleState } = await loadModule()
		expect(vehicleState.schema.shape.ownedNetIds).toBeDefined()
		expect(
			(vehicleState.schema.shape.ownedNetIds as { _def: { description?: string } })._def
				.description,
		).toMatch(/owned/i)
	})
})

describe('vehicle router — spawn', () => {
	it('returns a netId and tracks ownership', async () => {
		const { vehicleRouter, vehicleState } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const charId = ++charSeq
		const result = (await harness.dispatch(charId, 'spawn', {
			modelHash: 1234,
			x: 0,
			y: 0,
			z: 0,
		})) as { netId: number }
		expect(result.netId).toBeGreaterThan(0)
		expect(vehicleState.get(charId, 'ownedNetIds')).toContain(result.netId)
	})

	it('NOT_FOUND when no character', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({
			namespace: 'vehicle',
			router: vehicleRouter,
			charIdResolver: () => null,
		})
		await expect(
			harness.dispatch(1, 'spawn', { modelHash: 1, x: 0, y: 0, z: 0 }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
})

describe('vehicle router — despawn', () => {
	it('removes a vehicle from the owned list', async () => {
		const { vehicleRouter, vehicleState } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const charId = ++charSeq
		const { netId } = (await harness.dispatch(charId, 'spawn', {
			modelHash: 1,
			x: 0,
			y: 0,
			z: 0,
		})) as { netId: number }
		await harness.dispatch(charId, 'despawn', { netId })
		expect(vehicleState.get(charId, 'ownedNetIds')).not.toContain(netId)
	})

	it('AUTH_ERROR when despawning a non-owned vehicle', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const charId = ++charSeq
		await expect(
			harness.dispatch(charId, 'despawn', { netId: 999_999 }),
		).rejects.toMatchObject({ code: 'AUTH_ERROR' })
	})
})

describe('vehicle router — repair', () => {
	it('succeeds on owned vehicle', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const charId = ++charSeq
		const { netId } = (await harness.dispatch(charId, 'spawn', {
			modelHash: 1,
			x: 0,
			y: 0,
			z: 0,
		})) as { netId: number }
		const result = (await harness.dispatch(charId, 'repair', { netId })) as { ok: boolean }
		expect(result.ok).toBe(true)
	})

	it('AUTH_ERROR on non-owned', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		await expect(
			harness.dispatch(1, 'repair', { netId: 42 }),
		).rejects.toMatchObject({ code: 'AUTH_ERROR' })
	})
})

describe('vehicle router — getMyVehicles', () => {
	it('returns empty for fresh character', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const result = (await harness.dispatch(++charSeq, 'getMyVehicles')) as { netIds: number[] }
		expect(result.netIds).toEqual([])
	})

	it('returns the owned netIds', async () => {
		const { vehicleRouter } = await loadModule()
		const harness = createModuleHarness({ namespace: 'vehicle', router: vehicleRouter })
		const charId = ++charSeq
		await harness.dispatch(charId, 'spawn', { modelHash: 1, x: 0, y: 0, z: 0 })
		await harness.dispatch(charId, 'spawn', { modelHash: 2, x: 0, y: 0, z: 0 })
		const result = (await harness.dispatch(charId, 'getMyVehicles')) as { netIds: number[] }
		expect(result.netIds).toHaveLength(2)
	})
})
