import { NextVMEntity } from './entity'
import type { EntityHandle, Vec3, VehicleSeat } from './types'

/**
 * NextVMVehicle — Typed wrapper around FiveM vehicle natives.
 *
 * Concept v2.3, Chapter 7.1:
 *   Wraps: Vehicle natives, mods, fuel, damage
 *   Key abstractions: spawn(), setColor(), repair()
 */
export class NextVMVehicle extends NextVMEntity {
	constructor(handle: EntityHandle) {
		super(handle)
	}

	/** Wrap an existing vehicle handle */
	static fromHandle(handle: EntityHandle): NextVMVehicle {
		return new NextVMVehicle(handle)
	}

	/**
	 * Spawn a new vehicle at a position (server-side).
	 * Uses CreateVehicleServerSetter for proper OneSync entity creation.
	 */
	static spawn(
		modelHash: number,
		pos: Vec3,
		heading?: number,
	): NextVMVehicle {
		const handle = CreateVehicleServerSetter(
			modelHash,
			'automobile',
			pos.x,
			pos.y,
			pos.z,
			heading ?? 0.0,
		)
		return new NextVMVehicle(handle)
	}

	/** Get the vehicle's body health (0-1000) */
	getBodyHealth(): number {
		return GetVehicleBodyHealth(this.handle)
	}

	/** Set the vehicle's body health */
	setBodyHealth(health: number): void {
		SetVehicleBodyHealth(this.handle, health)
	}

	/** Get the vehicle's engine health (-4000 to 1000) */
	getEngineHealth(): number {
		return GetVehicleEngineHealth(this.handle)
	}

	/** Set the vehicle's engine health */
	setEngineHealth(health: number): void {
		SetVehicleEngineHealth(this.handle, health)
	}

	/** Get the vehicle's petrol tank health (0-1000) */
	getPetrolTankHealth(): number {
		return GetVehiclePetrolTankHealth(this.handle)
	}

	/** Set the vehicle's petrol tank health */
	setPetrolTankHealth(health: number): void {
		SetVehiclePetrolTankHealth(this.handle, health)
	}

	/** Get the vehicle's dirt level (0-15) */
	getDirtLevel(): number {
		return GetVehicleDirtLevel(this.handle)
	}

	/** Set the vehicle's dirt level */
	setDirtLevel(level: number): void {
		SetVehicleDirtLevel(this.handle, level)
	}

	/**
	 * Fully repair the vehicle.
	 * Resets body, engine, petrol tank, visual damage, and dirt.
	 */
	repair(): void {
		SetVehicleFixed(this.handle)
		SetVehicleDeformationFixed(this.handle)
		SetVehicleUndriveable(this.handle, false)
		SetVehicleEngineHealth(this.handle, 1000.0)
		SetVehicleBodyHealth(this.handle, 1000.0)
		SetVehiclePetrolTankHealth(this.handle, 1000.0)
		SetVehicleDirtLevel(this.handle, 0.0)
	}

	/** Set the vehicle's primary and secondary colors */
	setColors(primary: number, secondary: number): void {
		SetVehicleColours(this.handle, primary, secondary)
	}

	/** Get the vehicle's primary and secondary colors */
	getColors(): { primary: number; secondary: number } {
		const [primary, secondary] = GetVehicleColours(this.handle)
		return { primary, secondary }
	}

	/** Set the vehicle's number plate text */
	setNumberPlate(text: string): void {
		SetVehicleNumberPlateText(this.handle, text)
	}

	/** Get the vehicle's number plate text */
	getNumberPlate(): string {
		return GetVehicleNumberPlateText(this.handle)
	}

	/** Set the vehicle's number plate style (0-5) */
	setNumberPlateStyle(style: number): void {
		SetVehicleNumberPlateTextIndex(this.handle, style)
	}

	/** Check if the vehicle's engine is running */
	isEngineRunning(): boolean {
		return GetIsVehicleEngineRunning(this.handle)
	}

	/** Set the vehicle's engine state */
	setEngineRunning(running: boolean): void {
		SetVehicleEngineOn(this.handle, running, true, false)
	}

	/** Lock/unlock the vehicle */
	setLockStatus(status: number): void {
		SetVehicleDoorsLocked(this.handle, status)
	}

	/** Get the vehicle's lock status */
	getLockStatus(): number {
		return GetVehicleDoorLockStatus(this.handle)
	}

	/** Get the driver of this vehicle (ped handle, 0 if empty) */
	getDriver(): EntityHandle {
		return GetPedInVehicleSeat(this.handle, -1)
	}

	/** Get a specific passenger (ped handle, 0 if empty) */
	getPedInSeat(seat: VehicleSeat): EntityHandle {
		return GetPedInVehicleSeat(this.handle, seat)
	}

	/** Check if a specific seat is free */
	isSeatFree(seat: VehicleSeat): boolean {
		return IsVehicleSeatFree(this.handle, seat)
	}

	/** Get the maximum number of passengers */
	getMaxPassengers(): number {
		return GetVehicleMaxNumberOfPassengers(this.handle)
	}

	/** Set a door open/closed (0-5 for doors) */
	setDoorOpen(doorIndex: number, loose?: boolean): void {
		SetVehicleDoorOpen(this.handle, doorIndex, loose ?? false, false)
	}

	/** Close a door */
	setDoorClosed(doorIndex: number): void {
		SetVehicleDoorShut(this.handle, doorIndex, false)
	}

	/** Set window state */
	setWindowBroken(windowIndex: number, broken: boolean): void {
		if (broken) {
			SmashVehicleWindow(this.handle, windowIndex)
		} else {
			FixVehicleWindow(this.handle, windowIndex)
		}
	}

	/** Set the vehicle's livery */
	setLivery(livery: number): void {
		SetVehicleLivery(this.handle, livery)
	}

	/** Get the vehicle's current livery */
	getLivery(): number {
		return GetVehicleLivery(this.handle)
	}

	/** Explode the vehicle */
	explode(): void {
		ExplodeVehicle(this.handle, true, false)
	}
}
