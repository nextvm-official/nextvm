/**
 * Item registry for the inventory module.
 * module init time. Each item has a stable id, a translation key,
 * weight, and stacking rules.
 * not on a global static.
 */

export interface ItemDefinition {
	/** Stable id, e.g. 'water_bottle' */
	id: string
	/** i18n key for the display label, e.g. 'inventory.items.water_bottle' */
	labelKey: string
	/** Weight per unit (kg) */
	weight: number
	/** Whether multiple units stack into one slot */
	stackable: boolean
	/** Maximum units per stack (only relevant when stackable=true) */
	maxStack: number
	/** Optional category for grouping/filtering */
	category?: string
}

export class ItemRegistry {
	private items = new Map<string, ItemDefinition>()

	/** Register an item definition. Idempotent on the same id. */
	define(item: ItemDefinition): void {
		this.items.set(item.id, item)
	}

	/** Look up an item by id */
	get(id: string): ItemDefinition | undefined {
		return this.items.get(id)
	}

	/** True if the id is registered */
	has(id: string): boolean {
		return this.items.has(id)
	}

	/** All registered items */
	all(): ItemDefinition[] {
		return Array.from(this.items.values())
	}
}

/**
 * Helper to define an item without instantiating a registry.
 * Returned object can be passed to ItemRegistry.define().
 */
export function defineItem(item: ItemDefinition): ItemDefinition {
	return item
}
