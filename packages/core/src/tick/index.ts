/**
 * @nextvm/core/tick — Managed Tick System
 *
 * Concept v2.3, Chapter 21.1.
 *
 * Modules register ticks via `ctx.onTick(handler, { interval, priority })`.
 * The TickScheduler runs them on a single frame loop with priority-based
 * skipping when the per-frame budget is exhausted.
 */

export { TickScheduler } from './scheduler'
export type {
	RegisteredTick,
	TickSchedulerOptions,
	FrameStats,
} from './types'
