import { NextVMEntity } from './entity'
import type { EntityHandle, PlayerSource, Vec3, VehicleSeat } from './types'

/**
 * NextVMPlayer — Typed wrapper around FiveM player/ped natives.
 *   Wraps: Ped natives, identifiers, health, armor, position
 *   Key abstractions: setPosition(), getHealth(), teleport()
 * Server-side: constructed from player source (server ID).
 * Client-side: constructed from ped handle.
 */
export class NextVMPlayer extends NextVMEntity {
	constructor(
		handle: EntityHandle,
		public readonly source: PlayerSource,
	) {
		super(handle)
	}

	/**
	 * Create a NextVMPlayer from a server source ID.
	 * Server-side only.
	 */
	static fromSource(source: PlayerSource): NextVMPlayer {
		const ped = GetPlayerPed(String(source))
		return new NextVMPlayer(ped, source)
	}

	/** Get the player's ped handle (may change on respawn) */
	getPed(): EntityHandle {
		return GetPlayerPed(String(this.source))
	}

	/** Refresh the internal handle (call after respawn) */
	refreshHandle(): NextVMPlayer {
		return NextVMPlayer.fromSource(this.source)
	}

	/** Get player name */
	getName(): string {
		return GetPlayerName(String(this.source))
	}

	/**
	 * Get all identifiers for this player.
	 * Returns: { license, discord, steam, xbl, live, fivem, ... }
	 */
	getIdentifiers(): Record<string, string> {
		const identifiers: Record<string, string> = {}
		const count = GetNumPlayerIdentifiers(String(this.source))
		for (let i = 0; i < count; i++) {
			const id = GetPlayerIdentifier(String(this.source), i)
			if (id) {
				const [prefix] = id.split(':')
				if (prefix) {
					identifiers[prefix] = id
				}
			}
		}
		return identifiers
	}

	/** Get a specific identifier (e.g., 'license', 'discord', 'steam') */
	getIdentifier(type: string): string | undefined {
		return this.getIdentifiers()[type]
	}

	/** Get current armor level (0-100) */
	getArmor(): number {
		return GetPedArmour(this.handle)
	}

	/** Set armor level */
	setArmor(armor: number): void {
		SetPedArmour(this.handle, armor)
	}

	/**
	 * Teleport the player to a position.
	 * Handles freeze/unfreeze for clean teleport.
	 */
	teleport(pos: Vec3, heading?: number): void {
		this.setPosition(pos, { clearArea: true })
		if (heading !== undefined) {
			this.setHeading(heading)
		}
	}

	/** Check if the player is in a vehicle */
	isInVehicle(): boolean {
		return IsPedInAnyVehicle(this.handle, false)
	}

	/** Get the vehicle the player is currently in (handle or 0) */
	getCurrentVehicle(): EntityHandle {
		return GetVehiclePedIsIn(this.handle, false)
	}

	/** Get the last vehicle the player was in */
	getLastVehicle(): EntityHandle {
		return GetVehiclePedIsIn(this.handle, true)
	}

	/** Put the player into a vehicle at a specific seat */
	setIntoVehicle(vehicleHandle: EntityHandle, seat: VehicleSeat): void {
		SetPedIntoVehicle(this.handle, vehicleHandle, seat)
	}

	/** Remove the player from their current vehicle */
	removeFromVehicle(): void {
		if (this.isInVehicle()) {
			TaskLeaveAnyVehicle(this.handle, 0, 0)
		}
	}

	/** Check if the player is on foot */
	isOnFoot(): boolean {
		return IsPedOnFoot(this.handle)
	}

	/** Check if the player is swimming */
	isSwimming(): boolean {
		return IsPedSwimming(this.handle)
	}

	/** Check if the player is falling */
	isFalling(): boolean {
		return IsPedFalling(this.handle)
	}

	/** Get the player's current weapon hash */
	getCurrentWeapon(): number {
		const [, hash] = GetCurrentPedWeapon(this.handle, true)
		return hash
	}

	/** Give a weapon to the player */
	giveWeapon(weaponHash: number, ammo: number, hidden?: boolean): void {
		GiveWeaponToPed(this.handle, weaponHash, ammo, hidden ?? false, true)
	}

	/** Remove a weapon from the player */
	removeWeapon(weaponHash: number): void {
		RemoveWeaponFromPed(this.handle, weaponHash)
	}

	/** Remove all weapons from the player */
	removeAllWeapons(): void {
		RemoveAllPedWeapons(this.handle, true)
	}

	/** Set the player's routing bucket (server-side) */
	override setBucket(bucket: number): void {
		SetPlayerRoutingBucket(String(this.source), bucket)
	}

	/** Get the player's routing bucket */
	override getBucket(): number {
		return GetPlayerRoutingBucket(String(this.source))
	}

	/** Kick the player from the server */
	kick(reason?: string): void {
		DropPlayer(String(this.source), reason ?? 'Kicked from server')
	}

	/** Get the player's ping */
	getPing(): number {
		return GetPlayerPing(String(this.source))
	}

	/** Get the player's endpoint (IP:port) */
	getEndpoint(): string {
		return GetPlayerEndpoint(String(this.source))
	}
}
