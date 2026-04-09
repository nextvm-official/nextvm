/**
 * FiveM Native Type Declarations
 *
 * These are ambient declarations for FiveM's global native functions.
 * They exist at runtime in the CitizenFX V8/Node.js environment,
 * but TypeScript needs to know about them for type-checking.
 *
 * This file declares the subset of natives used by @nextvm/natives.
 * Full native reference: https://docs.fivem.net/natives/
 */

// --- Entity Natives ---
declare function DoesEntityExist(entity: number): boolean
declare function GetEntityCoords(entity: number, alive?: boolean): [number, number, number]
declare function SetEntityCoords(entity: number, x: number, y: number, z: number, xOff: boolean, yOff: boolean, zOff: boolean, clearArea: boolean): void
declare function GetEntityHeading(entity: number): number
declare function SetEntityHeading(entity: number, heading: number): void
declare function GetEntityRotation(entity: number, rotationOrder: number): [number, number, number]
declare function SetEntityRotation(entity: number, pitch: number, roll: number, yaw: number, rotationOrder: number, p5: boolean): void
declare function GetEntityVelocity(entity: number): [number, number, number]
declare function SetEntityVelocity(entity: number, x: number, y: number, z: number): void
declare function GetEntityHealth(entity: number): number
declare function SetEntityHealth(entity: number, health: number): void
declare function GetEntityMaxHealth(entity: number): number
declare function IsEntityDead(entity: number): boolean
declare function GetEntityModel(entity: number): number
declare function IsEntityVisible(entity: number): boolean
declare function SetEntityVisible(entity: number, toggle: boolean, unk: boolean): void
declare function FreezeEntityPosition(entity: number, toggle: boolean): void
declare function SetEntityInvincible(entity: number, toggle: boolean): void
declare function DeleteEntity(entity: number): void
declare function GetEntityRoutingBucket(entity: number): number
declare function SetEntityRoutingBucket(entity: number, bucket: number): void
declare function NetworkGetNetworkIdFromEntity(entity: number): number

// --- Ped / Player Natives ---
declare function GetPlayerPed(player: string): number
declare function GetPlayerName(player: string): string
declare function GetNumPlayerIdentifiers(player: string): number
declare function GetPlayerIdentifier(player: string, index: number): string | null
declare function GetPedArmour(ped: number): number
declare function SetPedArmour(ped: number, amount: number): void
declare function IsPedInAnyVehicle(ped: number, atGetIn: boolean): boolean
declare function GetVehiclePedIsIn(ped: number, lastVehicle: boolean): number
declare function SetPedIntoVehicle(ped: number, vehicle: number, seatIndex: number): void
declare function TaskLeaveAnyVehicle(ped: number, p1: number, flags: number): void
declare function IsPedOnFoot(ped: number): boolean
declare function IsPedSwimming(ped: number): boolean
declare function IsPedFalling(ped: number): boolean
declare function GetCurrentPedWeapon(ped: number, p1: boolean): [boolean, number]
declare function GiveWeaponToPed(ped: number, weaponHash: number, ammoCount: number, isHidden: boolean, bForceInHand: boolean): void
declare function RemoveWeaponFromPed(ped: number, weaponHash: number): void
declare function RemoveAllPedWeapons(ped: number, p1: boolean): void
declare function SetPlayerRoutingBucket(player: string, bucket: number): void
declare function GetPlayerRoutingBucket(player: string): number
declare function DropPlayer(player: string, reason: string): void
declare function GetPlayerPing(player: string): number
declare function GetPlayerEndpoint(player: string): string

// --- Vehicle Natives ---
declare function CreateVehicleServerSetter(modelHash: number, vehicleType: string, x: number, y: number, z: number, heading: number): number
declare function GetVehicleBodyHealth(vehicle: number): number
declare function SetVehicleBodyHealth(vehicle: number, value: number): void
declare function GetVehicleEngineHealth(vehicle: number): number
declare function SetVehicleEngineHealth(vehicle: number, value: number): void
declare function GetVehiclePetrolTankHealth(vehicle: number): number
declare function SetVehiclePetrolTankHealth(vehicle: number, value: number): void
declare function GetVehicleDirtLevel(vehicle: number): number
declare function SetVehicleDirtLevel(vehicle: number, dirtLevel: number): void
declare function SetVehicleFixed(vehicle: number): void
declare function SetVehicleDeformationFixed(vehicle: number): void
declare function SetVehicleUndriveable(vehicle: number, toggle: boolean): void
declare function SetVehicleColours(vehicle: number, primary: number, secondary: number): void
declare function GetVehicleColours(vehicle: number): [number, number]
declare function SetVehicleNumberPlateText(vehicle: number, plate: string): void
declare function GetVehicleNumberPlateText(vehicle: number): string
declare function SetVehicleNumberPlateTextIndex(vehicle: number, plateType: number): void
declare function GetIsVehicleEngineRunning(vehicle: number): boolean
declare function SetVehicleEngineOn(vehicle: number, value: boolean, instantly: boolean, disableAutoStart: boolean): void
declare function SetVehicleDoorsLocked(vehicle: number, doorLockStatus: number): void
declare function GetVehicleDoorLockStatus(vehicle: number): number
declare function GetPedInVehicleSeat(vehicle: number, seatIndex: number): number
declare function IsVehicleSeatFree(vehicle: number, seatIndex: number): boolean
declare function GetVehicleMaxNumberOfPassengers(vehicle: number): number
declare function SetVehicleDoorOpen(vehicle: number, doorIndex: number, loose: boolean, openInstantly: boolean): void
declare function SetVehicleDoorShut(vehicle: number, doorIndex: number, closeInstantly: boolean): void
declare function SmashVehicleWindow(vehicle: number, windowIndex: number): void
declare function FixVehicleWindow(vehicle: number, windowIndex: number): void
declare function SetVehicleLivery(vehicle: number, livery: number): void
declare function GetVehicleLivery(vehicle: number): number
declare function ExplodeVehicle(vehicle: number, isAudible: boolean, isInvisible: boolean): void

// --- World Natives ---
declare function SetWeatherTypeNowPersist(weatherType: string): void
declare function SetWeatherTypeOverTime(weatherType: string, time: number): void
declare function GetCurrentWeather(): [number, string]
declare function SetClockTime(hour: number, minute: number, second: number): void
declare function GetClockTime(): [number, number, number]
declare function FreezeTime(toggle: boolean): void
declare function AddBlipForCoord(x: number, y: number, z: number): number
declare function AddBlipForEntity(entity: number): number
declare function SetBlipSprite(blip: number, sprite: number): void
declare function SetBlipColour(blip: number, color: number): void
declare function SetBlipScale(blip: number, scale: number): void
declare function SetBlipAsShortRange(blip: number, toggle: boolean): void
declare function BeginTextCommandSetBlipName(textLabel: string): void
declare function AddTextComponentSubstringPlayerName(text: string): void
declare function EndTextCommandSetBlipName(blip: number): void
declare function RemoveBlip(blip: number): void
declare function DrawMarker(type: number, posX: number, posY: number, posZ: number, dirX: number, dirY: number, dirZ: number, rotX: number, rotY: number, rotZ: number, scaleX: number, scaleY: number, scaleZ: number, red: number, green: number, blue: number, alpha: number, bobUpAndDown: boolean, faceCamera: boolean, p19: number, rotate: boolean, textureDict: string | undefined, textureName: string | undefined, drawOnEnts: boolean): void
declare function GetGroundZFor_3dCoord(x: number, y: number, z: number, p3: boolean): [boolean, number]
declare function SetBlackout(toggle: boolean): void

// --- Network / State Bags ---
declare const GlobalState: {
	[key: string]: unknown
	set(key: string, value: unknown, replicated: boolean): void
}
declare function Player(source: string): { state: { [key: string]: unknown; set(key: string, value: unknown, replicated: boolean): void } } | null
declare function Entity(entity: number): { state: { [key: string]: unknown; set(key: string, value: unknown, replicated: boolean): void } } | null
declare function AddStateBagChangeHandler(keyFilter: string, bagFilter: string, handler: (bagName: string, key: string, value: unknown, reserved: number, replicated: boolean) => void): number
declare function RemoveStateBagChangeHandler(cookie: number): void
declare function RegisterNetEvent(eventName: string): void
declare function TriggerClientEvent(eventName: string, target: number, ...args: unknown[]): void
declare function GetNumPlayerIndices(): number
declare function GetPlayerFromIndex(index: number): string
declare function GetConvarInt(varName: string, defaultValue: number): number

// --- ACE / Permissions ---
declare function IsPlayerAceAllowed(player: string, object: string): boolean
declare function ExecuteCommand(command: string): void
declare function GetNumPlayerTokens(player: string): number
declare function GetPlayerToken(player: string, index: number): string

// --- Misc ---
declare function on(eventName: string, handler: (...args: unknown[]) => void): void
declare function setTimeout(callback: () => void, ms: number): number

/** FiveM exports proxy — access other resource exports */
declare const exports: {
	[resource: string]: {
		[method: string]: ((...args: never[]) => unknown) | undefined
	} | undefined
}
