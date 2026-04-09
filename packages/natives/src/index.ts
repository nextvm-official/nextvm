/**
 * @nextvm/natives — Typed FiveM Native Wrappers
 *
 * Abstraction layer over raw FiveM natives (Layer 2).
 * Modules MUST use these abstractions instead of calling natives directly (GUARD-001).
 *
 * Concept v2.3, Chapter 7: 12 Encapsulation Domains.
 * Phase 0 implements: Entity, Player, Vehicle, World, Network, Routing, Voice.
 * Remaining (Phase 1+): UI, Input, Streaming, Camera, Audio.
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

// Escape hatches (GUARD-010 — require benchmark justification at call site)
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
