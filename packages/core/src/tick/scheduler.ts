import type { ErrorBoundary } from '../errors/error-boundary'
import { createLogger } from '../logger/logger'
import type { TickHandler, TickOptions, TickPriority } from '../module/types'
import type { Profiler } from '../performance/profiler'
import type {
	FrameStats,
	RegisteredTick,
	TickSchedulerOptions,
} from './types'

/**
 * TickScheduler — Managed tick system with priority + budget control.
 *
 * Concept v2.3, Chapter 21.1:
 *   "No raw setTick(). Modules register ticks with priority (HIGH/MEDIUM/LOW)
 *    and min interval. Scheduler distributes CPU per frame, skips LOW ticks
 *    when budget exceeded."
 *
 * Concept v2.3, Chapter 22.2:
 *   Tick handlers are wrapped by an ErrorBoundary so a single bad tick
 *   cannot take down the server. Modules that exceed the error threshold
 *   are skipped automatically until manually re-enabled.
 *
 * GUARD-006 compliant: instance state, no globals.
 */
export class TickScheduler {
	private ticks: RegisteredTick[] = []
	private maxFrameMs: number
	private mediumSkipBelowMs: number
	private lowSkipBelowMs: number
	private errorBoundary: ErrorBoundary | null = null
	private profiler: Profiler | null = null
	/** Per-module last-frame tick time, surfaced to the profiler */
	private moduleTickTimes = new Map<string, number>()
	private log = createLogger('nextvm:tick')

	constructor(options: TickSchedulerOptions = {}) {
		this.maxFrameMs = options.maxFrameMs ?? 16
		this.mediumSkipBelowMs = options.mediumSkipBelowMs ?? 5
		this.lowSkipBelowMs = options.lowSkipBelowMs ?? 10
	}

	/** Wire up the error boundary so tick errors trigger module degradation */
	setErrorBoundary(boundary: ErrorBoundary): void {
		this.errorBoundary = boundary
	}

	/** Wire up a profiler so tick durations are sampled per module */
	setProfiler(profiler: Profiler): void {
		this.profiler = profiler
	}

	/**
	 * Register a tick handler under a module name.
	 *
	 * Modules register ticks via `ctx.onTick(handler, opts)`; the
	 * ModuleLoader forwards each registration here together with
	 * the owning module name.
	 */
	register(module: string, handler: TickHandler, opts: TickOptions = {}): void {
		this.ticks.push({
			module,
			handler,
			interval: opts.interval ?? 0,
			priority: opts.priority ?? 'MEDIUM',
			// Use -Infinity so the very first frame always passes the
			// interval gate regardless of the absolute clock value.
			lastRun: Number.NEGATIVE_INFINITY,
		})
	}

	/** Remove all ticks for a module (e.g. on module stop) */
	unregisterModule(module: string): void {
		this.ticks = this.ticks.filter((t) => t.module !== module)
		this.moduleTickTimes.delete(module)
	}

	/**
	 * Run one frame of the scheduler.
	 *
	 * In the FiveM runtime this is called from a single setTick() loop.
	 * In tests, callers invoke it directly with a fixed `now` for determinism.
	 *
	 * Two time sources are tracked separately:
	 *   - `now` (logical time): drives the per-tick interval gate
	 *   - `Date.now()` deltas from wallStart: drive the per-frame CPU budget
	 *
	 * This separation lets tests pass a deterministic `now` (e.g. 0, 500,
	 * 1500) for interval testing while the budget logic still measures
	 * real CPU time.
	 */
	async runFrame(now: number = Date.now()): Promise<FrameStats> {
		const wallStart = Date.now()
		const stats: FrameStats = {
			totalMs: 0,
			executed: 0,
			skippedMedium: 0,
			skippedLow: 0,
			skippedDegraded: 0,
		}
		// Reset per-module accumulator for this frame
		this.moduleTickTimes.clear()

		for (const tick of this.ticks) {
			// Interval gate (logical time)
			if (now - tick.lastRun < tick.interval) continue

			// Degraded modules — skip all their ticks
			if (this.errorBoundary?.isDegraded(tick.module)) {
				stats.skippedDegraded++
				continue
			}

			// Budget-based skip (real CPU time elapsed in this frame)
			const elapsed = Date.now() - wallStart
			const remaining = this.maxFrameMs - elapsed
			if (tick.priority === 'LOW' && remaining < this.lowSkipBelowMs) {
				stats.skippedLow++
				continue
			}
			if (tick.priority === 'MEDIUM' && remaining < this.mediumSkipBelowMs) {
				stats.skippedMedium++
				continue
			}

			const tickStart = Date.now()
			tick.lastRun = now

			if (this.errorBoundary) {
				await this.errorBoundary.wrapAsync(
					tick.module,
					'tick',
					'onTick',
					() => tick.handler(),
				)
			} else {
				try {
					await tick.handler()
				} catch (err) {
					this.log.error('Tick handler threw (no error boundary configured)', {
						module: tick.module,
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}

			const tickElapsed = Date.now() - tickStart
			this.moduleTickTimes.set(
				tick.module,
				(this.moduleTickTimes.get(tick.module) ?? 0) + tickElapsed,
			)
			// Feed the profiler so `nextvm perf` can surface this later
			this.profiler?.record('tick', tick.module, 'onTick', tickElapsed)
			stats.executed++
		}

		stats.totalMs = Date.now() - wallStart
		return stats
	}

	/** Per-module accumulated tick time from the most recent frame */
	getModuleTickTimes(): ReadonlyMap<string, number> {
		return this.moduleTickTimes
	}

	/** Number of registered ticks (introspection / tests) */
	getTickCount(): number {
		return this.ticks.length
	}

	/** Number of ticks for a specific module */
	getTickCountForModule(module: string): number {
		return this.ticks.filter((t) => t.module === module).length
	}

	/** Priority filter (introspection / tests) */
	getTicksByPriority(priority: TickPriority): RegisteredTick[] {
		return this.ticks.filter((t) => t.priority === priority)
	}
}
