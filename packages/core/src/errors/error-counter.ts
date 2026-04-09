import type { ModuleDegradation, ModuleErrorRecord } from './types'

/**
 * ErrorCounter — Tracks per-module error counts in a rolling time window.
 *   "If errors exceed threshold (default 10/minute):
 *     - Disables the module's tick handlers
 *     - Emits 'module:degraded' event
 *     - Logs a CRITICAL warning"
 */
export class ErrorCounter {
	/** Per-module error history (rolling window) */
	private errors = new Map<string, ModuleErrorRecord[]>()
	/** Per-module degradation status */
	private degraded = new Map<string, ModuleDegradation>()

	constructor(
		/** Threshold: errors per windowMs that triggers degradation */
		private readonly threshold: number = 10,
		/** Rolling window size in ms (default 60s) */
		private readonly windowMs: number = 60_000,
	) {}

	/**
	 * Record an error for a module.
	 * Returns true if this error pushed the module into degraded state.
	 */
	record(module: string, error: ModuleErrorRecord): boolean {
		let history = this.errors.get(module)
		if (!history) {
			history = []
			this.errors.set(module, history)
		}
		history.push(error)

		// Trim entries outside the window
		const cutoff = Date.now() - this.windowMs
		while (history.length > 0 && (history[0]?.timestamp ?? 0) < cutoff) {
			history.shift()
		}

		const status = this.ensureStatus(module)
		status.errorCount = history.length
		status.lastError = error

		const wasDegraded = status.degraded
		if (!wasDegraded && history.length >= this.threshold) {
			status.degraded = true
			status.degradedAt = Date.now()
			return true // Just degraded
		}
		return false
	}

	/** Check if a module is currently degraded */
	isDegraded(module: string): boolean {
		return this.degraded.get(module)?.degraded ?? false
	}

	/** Get the degradation status of a module */
	getStatus(module: string): ModuleDegradation {
		return this.ensureStatus(module)
	}

	/** Get statuses for all tracked modules */
	getAllStatuses(): ModuleDegradation[] {
		return Array.from(this.degraded.values())
	}

	/**
	 * Manually re-enable a module that was previously degraded.
	 */
	reEnable(module: string): void {
		const status = this.degraded.get(module)
		if (status) {
			status.degraded = false
			status.degradedAt = null
			status.errorCount = 0
		}
		this.errors.set(module, [])
	}

	private ensureStatus(module: string): ModuleDegradation {
		let status = this.degraded.get(module)
		if (!status) {
			status = {
				module,
				degraded: false,
				errorCount: 0,
				lastError: null,
				degradedAt: null,
			}
			this.degraded.set(module, status)
		}
		return status
	}
}
