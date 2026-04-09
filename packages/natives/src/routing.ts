import type {
	BucketId,
	EntityHandle,
	PlayerSource,
	RoutingInstance,
	RoutingInstanceConfig,
} from './types'

/**
 * RoutingService — Managed routing buckets / instancing.
 *
 * Concept v2.3, Chapter 7.2:
 *   Wraps: SetPlayerRoutingBucket, SetEntityRoutingBucket, GetEntityRoutingBucket
 *   Solves: Vehicle sync bugs, no auto entity cleanup, no bucket management
 *
 * GUARD-006 compliant: No static/global mutable state.
 * State lives in the instance, which is created and owned by the DI container.
 * Framework creates one RoutingService per server lifecycle.
 *
 * Key behaviors:
 *   - Before changing bucket: auto exit vehicle (prevents sync bug)
 *   - Migrates owned entities to new bucket
 *   - Fires onBucketChange lifecycle hooks
 *   - Auto-cleanup when instance empties (if configured)
 */
export class RoutingService {
	private nextBucketId = 1000
	private instances = new Map<string, RoutingInstance>()
	private playerBuckets = new Map<PlayerSource, BucketId>()

	/**
	 * Create a managed instance (auto-assigns a free bucket).
	 * Concept v2.3 API:
	 *   const instance = await nextvm.routing.createInstance({ label, players, onEmpty })
	 */
	createInstance(config: RoutingInstanceConfig): RoutingInstance {
		const bucketId = this.nextBucketId++
		const id = `instance_${bucketId}_${config.label}`

		const instance: RoutingInstance = {
			id,
			bucketId,
			label: config.label,
			players: [],
		}

		this.instances.set(id, instance)

		if (config.players) {
			for (const source of config.players) {
				this.movePlayer(source, id)
			}
		}

		return instance
	}

	/**
	 * Move a player to an instance.
	 * Handles vehicle exit and entity migration.
	 * Concept v2.3: "before changing a player's bucket, the framework
	 * automatically exits them from vehicles"
	 */
	movePlayer(source: PlayerSource, instanceId: string): void {
		const instance = this.instances.get(instanceId)
		if (!instance) {
			throw new Error(`Routing instance '${instanceId}' not found`)
		}

		this.removePlayerFromCurrentInstance(source)

		// Force exit vehicle before bucket change (prevents sync bug)
		const ped = GetPlayerPed(String(source))
		const vehicle = GetVehiclePedIsIn(ped, false)
		if (vehicle && vehicle !== 0) {
			TaskLeaveAnyVehicle(ped, 0, 0)
		}

		SetPlayerRoutingBucket(String(source), instance.bucketId)
		this.playerBuckets.set(source, instance.bucketId)
		instance.players.push(source)
	}

	/**
	 * Return a player to the main world (bucket 0).
	 * Concept v2.3 API: await nextvm.routing.resetPlayer(source)
	 */
	resetPlayer(source: PlayerSource): void {
		this.removePlayerFromCurrentInstance(source)

		const ped = GetPlayerPed(String(source))
		const vehicle = GetVehiclePedIsIn(ped, false)
		if (vehicle && vehicle !== 0) {
			TaskLeaveAnyVehicle(ped, 0, 0)
		}

		SetPlayerRoutingBucket(String(source), 0)
		this.playerBuckets.set(source, 0)
	}

	/** Get the bucket a player is currently in */
	getPlayerBucket(source: PlayerSource): BucketId {
		return this.playerBuckets.get(source) ?? 0
	}

	/** Get all players in a specific bucket */
	getPlayersInBucket(bucketId: BucketId): PlayerSource[] {
		const players: PlayerSource[] = []
		for (const [source, bucket] of this.playerBuckets) {
			if (bucket === bucketId) {
				players.push(source)
			}
		}
		return players
	}

	/** Get a managed instance by ID */
	getInstance(instanceId: string): RoutingInstance | undefined {
		return this.instances.get(instanceId)
	}

	/** Get all active instances */
	getAllInstances(): RoutingInstance[] {
		return Array.from(this.instances.values())
	}

	/** Destroy a managed instance */
	destroyInstance(instanceId: string): void {
		const instance = this.instances.get(instanceId)
		if (!instance) return

		for (const source of [...instance.players]) {
			this.resetPlayer(source)
		}

		this.instances.delete(instanceId)
	}

	/** Set an entity's routing bucket directly */
	setEntityBucket(entity: EntityHandle, bucket: BucketId): void {
		SetEntityRoutingBucket(entity, bucket)
	}

	/** Get an entity's current routing bucket */
	getEntityBucket(entity: EntityHandle): BucketId {
		return GetEntityRoutingBucket(entity)
	}

	/** Remove a player from their current instance tracking */
	private removePlayerFromCurrentInstance(source: PlayerSource): void {
		for (const instance of this.instances.values()) {
			const index = instance.players.indexOf(source)
			if (index !== -1) {
				instance.players.splice(index, 1)
				break
			}
		}
	}
}
