import type { EntityHandle, NetworkId, Vec3 } from './types'

/**
 * NextVMEntity — Base class for all entity wrappers.
 *
 * Wraps generic FiveM entity natives behind a typed API.
 * Concept v2.3, Chapter 7.1 + 7.4.
 *
 * GUARD-001: This IS the abstraction layer. Raw natives are called here
 * so that modules never need to call them directly.
 */
export class NextVMEntity {
	constructor(public readonly handle: EntityHandle) {}

	/** Check if this entity still exists in the game world */
	exists(): boolean {
		return DoesEntityExist(this.handle)
	}

	/** Get the entity's current position */
	getPosition(): Vec3 {
		const [x, y, z] = GetEntityCoords(this.handle, true)
		return { x, y, z }
	}

	/**
	 * Set the entity's position.
	 * Concept v2.3, Chapter 7.4:
	 *   Raw: SetEntityCoords(entity, x, y, z, xA, yA, zA, clear)
	 *   NextVM: entity.setPosition({ x, y, z })
	 */
	setPosition(pos: Vec3, opts?: { clearArea?: boolean }): void {
		SetEntityCoords(
			this.handle,
			pos.x,
			pos.y,
			pos.z,
			false,
			false,
			false,
			opts?.clearArea ?? false,
		)
	}

	/** Get the entity's current heading (0-360) */
	getHeading(): number {
		return GetEntityHeading(this.handle)
	}

	/** Set the entity's heading */
	setHeading(heading: number): void {
		SetEntityHeading(this.handle, heading)
	}

	/** Get the entity's rotation */
	getRotation(): Vec3 {
		const [x, y, z] = GetEntityRotation(this.handle, 2)
		return { x, y, z }
	}

	/** Set the entity's rotation */
	setRotation(rot: Vec3): void {
		SetEntityRotation(this.handle, rot.x, rot.y, rot.z, 2, true)
	}

	/** Get the entity's velocity */
	getVelocity(): Vec3 {
		const [x, y, z] = GetEntityVelocity(this.handle)
		return { x, y, z }
	}

	/** Set the entity's velocity */
	setVelocity(vel: Vec3): void {
		SetEntityVelocity(this.handle, vel.x, vel.y, vel.z)
	}

	/** Get the entity's current health */
	getHealth(): number {
		return GetEntityHealth(this.handle)
	}

	/** Set the entity's health */
	setHealth(health: number): void {
		SetEntityHealth(this.handle, health)
	}

	/** Get the entity's max health */
	getMaxHealth(): number {
		return GetEntityMaxHealth(this.handle)
	}

	/** Check if the entity is dead */
	isDead(): boolean {
		return IsEntityDead(this.handle)
	}

	/** Get the entity's model hash */
	getModel(): number {
		return GetEntityModel(this.handle)
	}

	/** Check if entity is visible */
	isVisible(): boolean {
		return IsEntityVisible(this.handle)
	}

	/** Set entity visibility */
	setVisible(visible: boolean): void {
		SetEntityVisible(this.handle, visible, false)
	}

	/** Freeze entity position (prevent movement) */
	freeze(frozen: boolean): void {
		FreezeEntityPosition(this.handle, frozen)
	}

	/** Set entity invincibility */
	setInvincible(invincible: boolean): void {
		SetEntityInvincible(this.handle, invincible)
	}

	/** Get the entity's network ID (for synced entities) */
	getNetworkId(): NetworkId {
		return NetworkGetNetworkIdFromEntity(this.handle)
	}

	/** Delete this entity from the game world */
	delete(): void {
		DeleteEntity(this.handle)
	}

	/** Get the routing bucket this entity is in */
	getBucket(): number {
		return GetEntityRoutingBucket(this.handle)
	}

	/** Set the routing bucket for this entity */
	setBucket(bucket: number): void {
		SetEntityRoutingBucket(this.handle, bucket)
	}

	/** Get the distance to another position */
	distanceTo(pos: Vec3): number {
		const myPos = this.getPosition()
		const dx = myPos.x - pos.x
		const dy = myPos.y - pos.y
		const dz = myPos.z - pos.z
		return Math.sqrt(dx * dx + dy * dy + dz * dz)
	}
}
