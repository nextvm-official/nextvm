import type { Vec3 } from '@nextvm/natives'

/**
 * Property registry — declarative description of properties available
 * on the server. Server-authoritative purchase / ownership lives on
 * the HousingService that wraps this registry.
 * routing buckets. The propertyId is mapped to a routing-instance
 * label so HousingService can spin up an instance on demand.
 */

export type PropertyType = 'apartment' | 'house' | 'business' | 'warehouse'

export interface PropertyDefinition {
	id: string
	label: string
	type: PropertyType
	entrance: Vec3
	price: number
	maxOccupants: number
}

export class PropertyRegistry {
	private props = new Map<string, PropertyDefinition>()

	define(prop: PropertyDefinition): void {
		this.props.set(prop.id, prop)
	}

	get(id: string): PropertyDefinition | undefined {
		return this.props.get(id)
	}

	all(): PropertyDefinition[] {
		return Array.from(this.props.values())
	}

	/**
	 * Find every property whose entrance is within `radius` meters of
	 * the supplied coordinates. Used by the `getNearbyProperties` RPC.
	 */
	findNearby(coords: Vec3, radius: number): PropertyDefinition[] {
		const r2 = radius * radius
		return this.all().filter((p) => {
			const dx = p.entrance.x - coords.x
			const dy = p.entrance.y - coords.y
			const dz = p.entrance.z - coords.z
			return dx * dx + dy * dy + dz * dz <= r2
		})
	}
}

export function defineProperty(p: PropertyDefinition): PropertyDefinition {
	return p
}
