import { createModuleHarness } from '@nextvm/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { ItemRegistry, buildInventoryRouter, defineItem, inventoryState } from '../src'

let charSeq = 1000

const buildHarness = (opts?: { maxSlots?: number; maxWeightKg?: number }) => {
	const registry = new ItemRegistry()
	registry.define(
		defineItem({
			id: 'water',
			labelKey: 'inventory.items.water',
			weight: 0.5,
			stackable: true,
			maxStack: 5,
		}),
	)
	registry.define(
		defineItem({
			id: 'phone',
			labelKey: 'inventory.items.phone',
			weight: 0.2,
			stackable: false,
			maxStack: 1,
		}),
	)
	registry.define(
		defineItem({
			id: 'brick',
			labelKey: 'inventory.items.brick',
			weight: 30,
			stackable: true,
			maxStack: 99,
		}),
	)
	const harness = createModuleHarness({
		namespace: 'inventory',
		router: buildInventoryRouter(registry, opts?.maxSlots ?? 4, opts?.maxWeightKg ?? 50),
	})
	const charId = ++charSeq
	return { registry, harness, charId }
}

describe('ItemRegistry', () => {
	it('define + get + has + all', () => {
		const reg = new ItemRegistry()
		reg.define(defineItem({ id: 'a', labelKey: 'k', weight: 1, stackable: true, maxStack: 10 }))
		expect(reg.has('a')).toBe(true)
		expect(reg.has('b')).toBe(false)
		expect(reg.get('a')?.weight).toBe(1)
		expect(reg.all()).toHaveLength(1)
	})

	it('define is idempotent on the same id', () => {
		const reg = new ItemRegistry()
		reg.define(defineItem({ id: 'a', labelKey: 'k', weight: 1, stackable: true, maxStack: 10 }))
		reg.define(defineItem({ id: 'a', labelKey: 'k', weight: 2, stackable: true, maxStack: 10 }))
		expect(reg.all()).toHaveLength(1)
		expect(reg.get('a')?.weight).toBe(2)
	})
})

describe('inventory router — addItem', () => {
	beforeEach(() => {
		// charSeq guarantees fresh state per test, but clear anyway in case
	})

	it('adds a fresh stack into the first free slot', async () => {
		const { harness, charId } = buildHarness()
		const result = await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 3 })
		expect(result).toEqual({ ok: true, added: 3 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string; count: number } }>
		}
		expect(inv.slots).toHaveLength(1)
		expect(inv.slots[0]).toMatchObject({ slot: 0, stack: { itemId: 'water', count: 3 } })
	})

	it('stacks into existing stacks before opening new slots', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 3 })
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 1 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string; count: number } }>
		}
		expect(inv.slots).toHaveLength(1)
		expect(inv.slots[0].stack.count).toBe(4)
	})

	it('overflows into a new slot when stack is full', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 5 })
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 2 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string; count: number } }>
		}
		expect(inv.slots).toHaveLength(2)
		expect(inv.slots[0].stack.count).toBe(5)
		expect(inv.slots[1].stack.count).toBe(2)
	})

	it('rejects unknown items', async () => {
		const { harness, charId } = buildHarness()
		await expect(
			harness.dispatch(charId, 'addItem', { itemId: 'noop', count: 1 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('rejects when weight limit would be exceeded', async () => {
		const { harness, charId } = buildHarness({ maxWeightKg: 50, maxSlots: 10 })
		await expect(
			harness.dispatch(charId, 'addItem', { itemId: 'brick', count: 2 }), // 60kg
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('rejects when inventory is full', async () => {
		const { harness, charId } = buildHarness({ maxSlots: 2, maxWeightKg: 100 })
		await harness.dispatch(charId, 'addItem', { itemId: 'phone', count: 1 })
		await harness.dispatch(charId, 'addItem', { itemId: 'phone', count: 1 })
		await expect(
			harness.dispatch(charId, 'addItem', { itemId: 'phone', count: 1 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('non-stackable items always take a fresh slot', async () => {
		const { harness, charId } = buildHarness({ maxSlots: 4 })
		await harness.dispatch(charId, 'addItem', { itemId: 'phone', count: 2 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string; count: number } }>
		}
		expect(inv.slots).toHaveLength(2)
		expect(inv.slots.every((s) => s.stack.count === 1)).toBe(true)
	})
})

describe('inventory router — useItem', () => {
	it('decrements the stack and removes empty slots', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 2 })
		await harness.dispatch(charId, 'useItem', { slot: 0 })
		const inv1 = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string; count: number } }>
		}
		expect(inv1.slots[0].stack.count).toBe(1)
		await harness.dispatch(charId, 'useItem', { slot: 0 })
		const inv2 = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: unknown[]
		}
		expect(inv2.slots).toHaveLength(0)
	})

	it('rejects empty slots', async () => {
		const { harness, charId } = buildHarness()
		await expect(harness.dispatch(charId, 'useItem', { slot: 0 })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		})
	})
})

describe('inventory router — dropItem', () => {
	it('drops a partial count', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 5 })
		await harness.dispatch(charId, 'dropItem', { slot: 0, count: 2 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ stack: { count: number } }>
		}
		expect(inv.slots[0].stack.count).toBe(3)
	})

	it('rejects dropping more than the stack has', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 1 })
		await expect(
			harness.dispatch(charId, 'dropItem', { slot: 0, count: 5 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})
})

describe('inventory router — moveItem', () => {
	it('moves a stack to a free slot', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 2 })
		await harness.dispatch(charId, 'moveItem', { fromSlot: 0, toSlot: 2 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number }>
		}
		expect(inv.slots[0].slot).toBe(2)
	})

	it('swaps two occupied slots', async () => {
		const { harness, charId } = buildHarness()
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 1 })
		await harness.dispatch(charId, 'addItem', { itemId: 'phone', count: 1 })
		await harness.dispatch(charId, 'moveItem', { fromSlot: 0, toSlot: 1 })
		const inv = (await harness.dispatch(charId, 'getMyInventory')) as {
			slots: Array<{ slot: number; stack: { itemId: string } }>
		}
		const bySlot = Object.fromEntries(inv.slots.map((s) => [s.slot, s.stack.itemId]))
		expect(bySlot[0]).toBe('phone')
		expect(bySlot[1]).toBe('water')
	})

	it('rejects move to slot beyond maxSlots', async () => {
		const { harness, charId } = buildHarness({ maxSlots: 2 })
		await harness.dispatch(charId, 'addItem', { itemId: 'water', count: 1 })
		await expect(
			harness.dispatch(charId, 'moveItem', { fromSlot: 0, toSlot: 5 }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})
})

describe('inventoryState shape', () => {
	it('has the slots field with describe()', () => {
		expect(inventoryState.schema.shape.slots).toBeDefined()
		expect(inventoryState.schema.shape.slots._def.description).toMatch(/character/i)
	})
})
