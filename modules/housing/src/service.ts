import type { RoutingService } from '@nextvm/natives'
import type { BankingAdapter } from './banking-adapter'
import type { PropertyDefinition, PropertyRegistry } from './property-registry'
import { housingState } from './state'

/**
 * HousingService — owns purchase + entry/leave logic.
 * Server-authoritative. Cross-module access (banking,
 * routing) goes through small adapter interfaces, not via direct
 * imports of the other modules.
 */
export class HousingService {
	constructor(
		private readonly registry: PropertyRegistry,
		private readonly routing: RoutingService,
		private banking: BankingAdapter | null = null,
	) {}

	setBanking(banking: BankingAdapter): void {
		this.banking = banking
	}

	getOwned(charId: number): PropertyDefinition[] {
		const ids = housingState.get(charId, 'ownedPropertyIds')
		return ids
			.map((id) => this.registry.get(id))
			.filter((p): p is PropertyDefinition => p !== undefined)
	}

	/**
	 * Buy a property if the character can afford it.
	 * Throws on unknown property, already owned, or insufficient funds.
	 */
	async purchase(charId: number, propertyId: string): Promise<PropertyDefinition> {
		const prop = this.registry.get(propertyId)
		if (!prop) throw new Error('UNKNOWN_PROPERTY')
		const owned = housingState.get(charId, 'ownedPropertyIds')
		if (owned.includes(propertyId)) throw new Error('ALREADY_OWNED')

		if (!this.banking) {
			throw new Error('BANKING_UNAVAILABLE')
		}
		// Server-authoritative debit. Will throw INSUFFICIENT_FUNDS if too poor.
		await this.banking.removeMoney(charId, 'bank', prop.price, `housing:${propertyId}`)

		housingState.set(charId, 'ownedPropertyIds', [...owned, propertyId])
		return prop
	}

	/**
	 * Move the player into the property's instance bucket. Returns the
	 * instance the player is now in. The character must own the property.
	 */
	enter(charId: number, source: number, propertyId: string): { instanceId: string } {
		const prop = this.registry.get(propertyId)
		if (!prop) throw new Error('UNKNOWN_PROPERTY')
		const owned = housingState.get(charId, 'ownedPropertyIds')
		if (!owned.includes(propertyId)) throw new Error('NOT_OWNER')

		// Reuse an existing instance for this property if the character is
		// already inside, otherwise create a fresh one.
		const existing = housingState.get(charId, 'currentInstanceId')
		if (existing) {
			// Make sure they leave their current instance first.
			this.routing.resetPlayer(source)
		}
		const instance = this.routing.createInstance({
			label: `housing_${propertyId}_${charId}`,
			players: [source],
		})
		housingState.set(charId, 'currentInstanceId', instance.id)
		return { instanceId: instance.id }
	}

	/** Send the character back to the main world */
	leave(charId: number, source: number): void {
		const instanceId = housingState.get(charId, 'currentInstanceId')
		if (!instanceId) return
		this.routing.resetPlayer(source)
		housingState.set(charId, 'currentInstanceId', null)
	}

	getRegistry(): PropertyRegistry {
		return this.registry
	}
}
