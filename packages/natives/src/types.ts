/** 3D vector used throughout the framework */
export interface Vec3 {
	x: number
	y: number
	z: number
}

/** Entity handle (number in FiveM) */
export type EntityHandle = number

/** Player server ID */
export type PlayerSource = number

/** Routing bucket ID */
export type BucketId = number

/** Network ID for synced entities */
export type NetworkId = number

/** Vehicle seat index */
export enum VehicleSeat {
	Driver = -1,
	Passenger = 0,
	LeftRear = 1,
	RightRear = 2,
}

/** Voice proximity modes (wraps pma-voice) */
export type VoiceProximity = 'whisper' | 'normal' | 'shout'

/** Routing instance configuration */
export interface RoutingInstanceConfig {
	label: string
	players?: PlayerSource[]
	onEmpty?: 'destroy' | 'keep'
}

/** Routing instance handle */
export interface RoutingInstance {
	id: string
	bucketId: BucketId
	label: string
	players: PlayerSource[]
}

/** Weather types available in GTA V */
export type WeatherType =
	| 'CLEAR'
	| 'EXTRASUNNY'
	| 'CLOUDS'
	| 'OVERCAST'
	| 'RAIN'
	| 'CLEARING'
	| 'THUNDER'
	| 'SMOG'
	| 'FOGGY'
	| 'XMAS'
	| 'SNOWLIGHT'
	| 'BLIZZARD'
	| 'NEUTRAL'

/** Blip configuration */
export interface BlipConfig {
	coords: Vec3
	sprite?: number
	color?: number
	scale?: number
	label: string
	shortRange?: boolean
}

/** Marker configuration */
export interface MarkerConfig {
	type: number
	coords: Vec3
	dir?: Vec3
	rot?: Vec3
	scale?: Vec3
	color?: { r: number; g: number; b: number; a: number }
	bobUpAndDown?: boolean
	faceCamera?: boolean
	rotate?: boolean
}
