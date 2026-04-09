/**
 * @nextvm/natives — Typed FiveM Native Wrappers
 * Abstraction layer over raw FiveM natives (Layer 2).
 * Modules MUST use these abstractions instead of calling natives directly.
 * Remaining: UI, Input, Streaming, Camera, Audio.
 */

// Domain classes
export { NextVMEntity } from './entity'
export { NextVMPlayer } from './player'
export { NextVMVehicle } from './vehicle'
export { World } from './world'
export { Network } from './network'
export { RoutingService } from './routing'
export { Voice } from './voice'
export { Permissions } from './permissions'

// Escape hatches
export { useNative } from './use-native'
export { createBatchProcessor } from './batch-processor'
export type { BatchProcessor, BatchProcessorOptions } from './batch-processor'

// Types
export type {
	Vec3,
	EntityHandle,
	PlayerSource,
	BucketId,
	NetworkId,
	VoiceProximity,
	WeatherType,
	BlipConfig,
	MarkerConfig,
	RoutingInstanceConfig,
	RoutingInstance,
} from './types'

export { VehicleSeat } from './types'
