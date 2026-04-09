/**
 * @nextvm/core/state — Typed Character-Scoped State Management
 *
 * Concept v2.3, Chapter 11.
 *
 * Usage:
 *   import { defineState, z, StateBagBackend } from '@nextvm/core'
 *
 *   const playerState = defineState('player', {
 *     job: z.string().default('unemployed'),
 *     cash: z.number().default(0),
 *     bank: z.number().default(500),
 *   }, { backend: new StateBagBackend() })
 *
 *   playerState.set(charId, 'cash', 1500)
 *   playerState.increment(charId, 'cash', 500)
 *   const unsub = playerState.subscribe(charId, 'job', (newJob, oldJob) => { ... })
 */

export { defineState } from './define-state'
export { StateStore } from './state-store'
export { StateBagBackend } from './state-bag-backend'
export type { StateBackend, StateSubscriber, StateData } from './types'
