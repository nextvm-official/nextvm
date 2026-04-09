/**
 * @nextvm/core/errors — Module Error Boundaries
 * Provides try/catch wrappers, error counting with threshold-based
 * module degradation, and 'module:degraded' / 'module:recovered' events.
 * Used internally by ModuleLoader, EventBus, RpcRouter, and StateStore
 * to ensure crashing modules cannot take down the server.
 */

export { ErrorBoundary } from './error-boundary'
export { ErrorCounter } from './error-counter'
export type { ErrorOrigin, ModuleErrorRecord, ModuleDegradation } from './types'
