/**
 * @nextvm/core — NextVM Framework Core (Layer 3)
 *
 * Module system, dependency injection, lifecycle hooks,
 * event bus, structured logging.
 *
 * RPC and state management are Phase 1 additions.
 */

// Module system
export { defineModule } from './module/define-module'
export { defineExports } from './module/define-exports'
export { ModuleLoader } from './module/module-loader'
export type {
	ModuleDefinition,
	ModuleContext,
	ModuleEventBus,
	ModuleLogger,
	PlayerInfo,
	DeferralHandle,
	TickPriority,
	TickOptions,
} from './module/types'

// Dependency Injection
export { DIContainer } from './di/container'

// Event Bus
export { EventBus } from './events/event-bus'

// Logger
export { Logger, createLogger } from './logger/logger'

// RPC System (Concept v2.3, Chapter 10)
export {
	defineRouter,
	procedure,
	RpcRouter,
	RateLimiter,
	createClient,
	RpcError,
} from './rpc'
export type {
	Router,
	ClientRouter,
	ProcedureDefinition,
	ProcedureType,
	RpcContext,
	RpcErrorCode,
	RpcEncryptionAdapter,
	AuthMiddleware,
	InferInput,
	InferOutput,
	RpcTransport,
	RpcErrorReporter,
} from './rpc'

// State Management (Concept v2.3, Chapter 11)
export { defineState, StateStore, StateBagBackend } from './state'
export type { StateBackend, StateSubscriber, StateData } from './state'

// Permissions (Concept v2.3, Chapter 20.3)
export { PermissionsService } from './permissions'
export type { Permission, Role, PermissionDefinition } from './permissions'

// Error Boundaries (Concept v2.3, Chapter 22.2)
export { ErrorBoundary, ErrorCounter } from './errors'
export type { ErrorOrigin, ModuleErrorRecord, ModuleDegradation } from './errors'

// Tick System (Concept v2.3, Chapter 21.1)
export { TickScheduler } from './tick'
export type { RegisteredTick, TickSchedulerOptions, FrameStats } from './tick'

// Performance Profiler (Concept v2.3, Chapter 21.2)
export { Profiler } from './performance'
export type { PerfStats, SampleKind } from './performance'

// Integrations (Concept v2.3, Chapter 29 — txAdmin, etc.)
export { bindTxAdmin } from './integrations'
export type { TxAdminEventBinder, TxAdminIntegrationDeps } from './integrations'

// Character System (Concept v2.3, Chapter 9)
export { CharacterService } from './character/character-service'
export type {
	User,
	Character,
	CreateCharacterInput,
	PlayerSession,
	CharacterLifecycleState,
} from './character/types'
export type { CharacterRepository } from './character/character-repository'

// Re-export Zod so modules import { defineModule, z } from '@nextvm/core'
// Deliberate DX decision (Concept v2.3, Chapter 8.1)
export { z } from 'zod'
