import type { PerfStats, SampleKind } from './types'

/**
 * Profiler — Captures duration samples per (kind, module, name).
 *
 * Concept v2.3, Chapter 21.2:
 *   "Built-in profiler" — measures tick/rpc/db/event durations and
 *   surfaces aggregated stats (avg/p50/p95/p99/max).
 *
 * Stores a rolling window of the most recent N samples per series so
 * memory stays bounded even on long-running servers.
 *
 * GUARD-006 compliant: instance state, no globals.
 */
export class Profiler {
	/** kind:module:name → ring buffer of recent durations in ms */
	private samples = new Map<string, number[]>()

	constructor(
		/** Maximum samples retained per series (rolling window) */
		private readonly windowSize: number = 200,
	) {}

	/**
	 * Record a duration sample.
	 *
	 * Most callers use one of the typed helpers (`tick()`, `rpc()`, etc.)
	 * which build the key for them.
	 */
	record(kind: SampleKind, module: string, name: string, durationMs: number): void {
		const key = this.buildKey(kind, module, name)
		let series = this.samples.get(key)
		if (!series) {
			series = []
			this.samples.set(key, series)
		}
		series.push(durationMs)
		if (series.length > this.windowSize) {
			series.shift()
		}
	}

	/**
	 * Time a function and record its duration. Returns the function result.
	 */
	async time<T>(
		kind: SampleKind,
		module: string,
		name: string,
		fn: () => T | Promise<T>,
	): Promise<T> {
		const start = Date.now()
		try {
			return await fn()
		} finally {
			this.record(kind, module, name, Date.now() - start)
		}
	}

	/** Get aggregated stats for a single series, or null if no samples */
	getStats(kind: SampleKind, module: string, name: string): PerfStats | null {
		const key = this.buildKey(kind, module, name)
		const series = this.samples.get(key)
		if (!series || series.length === 0) return null
		return this.computeStats(series)
	}

	/** Get aggregated stats for every recorded series */
	getAllStats(): Record<string, PerfStats> {
		const result: Record<string, PerfStats> = {}
		for (const [key, series] of this.samples) {
			if (series.length > 0) result[key] = this.computeStats(series)
		}
		return result
	}

	/** Get stats grouped by module (sums across all series for that module) */
	getStatsByModule(module: string): Record<string, PerfStats> {
		const result: Record<string, PerfStats> = {}
		for (const [key, series] of this.samples) {
			if (!key.includes(`:${module}:`)) continue
			if (series.length > 0) result[key] = this.computeStats(series)
		}
		return result
	}

	/** Drop all samples (e.g. between profiling sessions) */
	reset(): void {
		this.samples.clear()
	}

	/** Number of recorded series — useful in tests */
	getSeriesCount(): number {
		return this.samples.size
	}

	private buildKey(kind: SampleKind, module: string, name: string): string {
		return `${kind}:${module}:${name}`
	}

	private computeStats(samples: number[]): PerfStats {
		const sorted = [...samples].sort((a, b) => a - b)
		const sum = sorted.reduce((acc, n) => acc + n, 0)
		const len = sorted.length
		return {
			count: len,
			avg: sum / len,
			min: sorted[0]!,
			max: sorted[len - 1]!,
			p50: this.percentile(sorted, 0.5),
			p95: this.percentile(sorted, 0.95),
			p99: this.percentile(sorted, 0.99),
		}
	}

	private percentile(sorted: number[], p: number): number {
		if (sorted.length === 0) return 0
		const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
		return sorted[idx]!
	}
}
