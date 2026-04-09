/**
 * Performance / Profiler types.
 */

/** Aggregated stats for a single sample series */
export interface PerfStats {
	count: number
	avg: number
	min: number
	max: number
	p50: number
	p95: number
	p99: number
}

export type SampleKind = 'tick' | 'rpc' | 'db' | 'event'
