import type { BlipConfig, MarkerConfig, Vec3, WeatherType } from './types'

/**
 * World — Static utility class for world manipulation.
 *   Wraps: Weather, time, blips, markers, zones
 *   Key abstractions: World.setWeather(), World.createBlip(), World.createZone()
 */
export class World {
	private constructor() {} // Static-only class

	/** Set the current weather type */
	static setWeather(weather: WeatherType): void {
		SetWeatherTypeNowPersist(weather)
	}

	/** Set weather with a transition */
	static transitionWeather(weather: WeatherType, duration: number): void {
		SetWeatherTypeOverTime(weather, duration)
	}

	/** Get the current weather type */
	static getWeather(): string {
		const [, weather] = GetCurrentWeather()
		return weather
	}

	/** Set the game time */
	static setTime(hour: number, minute: number, second?: number): void {
		SetClockTime(hour, minute, second ?? 0)
	}

	/** Get the current game time */
	static getTime(): { hour: number; minute: number; second: number } {
		const [hour, minute, second] = GetClockTime()
		return { hour, minute, second }
	}

	/** Freeze the game clock */
	static freezeTime(frozen: boolean): void {
		FreezeTime(frozen)
	}

	/** Create a blip at a position */
	static createBlip(config: BlipConfig): number {
		const blip = AddBlipForCoord(config.coords.x, config.coords.y, config.coords.z)
		if (config.sprite !== undefined) SetBlipSprite(blip, config.sprite)
		if (config.color !== undefined) SetBlipColour(blip, config.color)
		if (config.scale !== undefined) SetBlipScale(blip, config.scale)
		if (config.shortRange !== undefined) SetBlipAsShortRange(blip, config.shortRange)
		BeginTextCommandSetBlipName('STRING')
		AddTextComponentSubstringPlayerName(config.label)
		EndTextCommandSetBlipName(blip)
		return blip
	}

	/** Create a blip attached to an entity */
	static createBlipForEntity(entityHandle: number, config: Omit<BlipConfig, 'coords'>): number {
		const blip = AddBlipForEntity(entityHandle)
		if (config.sprite !== undefined) SetBlipSprite(blip, config.sprite)
		if (config.color !== undefined) SetBlipColour(blip, config.color)
		if (config.scale !== undefined) SetBlipScale(blip, config.scale)
		if (config.shortRange !== undefined) SetBlipAsShortRange(blip, config.shortRange)
		BeginTextCommandSetBlipName('STRING')
		AddTextComponentSubstringPlayerName(config.label)
		EndTextCommandSetBlipName(blip)
		return blip
	}

	/** Remove a blip */
	static removeBlip(blip: number): void {
		RemoveBlip(blip)
	}

	/**
	 * Draw a marker (must be called every frame in a tick handler).
	 * Provides a cleaner API than the raw 20+ parameter native.
	 */
	static drawMarker(config: MarkerConfig): void {
		const dir = config.dir ?? { x: 0, y: 0, z: 0 }
		const rot = config.rot ?? { x: 0, y: 0, z: 0 }
		const scale = config.scale ?? { x: 1, y: 1, z: 1 }
		const color = config.color ?? { r: 255, g: 255, b: 255, a: 200 }
		DrawMarker(
			config.type,
			config.coords.x,
			config.coords.y,
			config.coords.z,
			dir.x,
			dir.y,
			dir.z,
			rot.x,
			rot.y,
			rot.z,
			scale.x,
			scale.y,
			scale.z,
			color.r,
			color.g,
			color.b,
			color.a,
			config.bobUpAndDown ?? false,
			config.faceCamera ?? false,
			2,
			config.rotate ?? false,
			undefined,
			undefined,
			false,
		)
	}

	/** Get the ground Z coordinate at a position */
	static getGroundZ(pos: Vec3): number | undefined {
		const [found, z] = GetGroundZFor_3dCoord(pos.x, pos.y, pos.z, false)
		return found ? z : undefined
	}

	/** Calculate distance between two points */
	static distance(a: Vec3, b: Vec3): number {
		const dx = a.x - b.x
		const dy = a.y - b.y
		const dz = a.z - b.z
		return Math.sqrt(dx * dx + dy * dy + dz * dz)
	}

	/** Set the blackout state (EMP effect — disables all lights) */
	static setBlackout(enabled: boolean): void {
		SetBlackout(enabled)
	}
}
