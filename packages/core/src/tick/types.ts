/**
 * Tick System Types.
 */

import type { TickPriority } from '../module/types'

/** A registered tick handler */
export interface RegisteredTick {
	/** Module that owns this tick — used for error attribution + degradation skip */
	module: string
	/** The handler function */
	handler: () => void | Promise<void>
	/** Minimum ms between calls (default: 0 = every frame) */
	interval: number
	/** Priority — drives skip behavior under budget pressure */
	priority: TickPriority
	/** Last execution timestamp (ms since epoch) */
	lastRun: number
}

/** Scheduler configuration */
export interface TickSchedulerOptions {
	/**
	 * Soft per-frame budget in ms. When the elapsed budget exceeds the
	 * thresholds, MEDIUM and LOW ticks are skipped for the remainder
	 * of the frame.
	 */
	maxFrameMs?: number
	/** Frame budget remaining below which MEDIUM ticks are skipped */
	mediumSkipBelowMs?: number
	/** Frame budget remaining below which LOW ticks are skipped */
	lowSkipBelowMs?: number
}

/** Per-frame execution stats — useful for tests + the profiler */
export interface FrameStats {
	totalMs: number
	executed: number
	skippedMedium: number
	skippedLow: number
	skippedDegraded: number
}
