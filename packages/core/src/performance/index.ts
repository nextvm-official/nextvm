/**
 * @nextvm/core/performance — Built-in profiler
 * Records duration samples per (kind, module, name) and surfaces
 * aggregated stats (avg, p50, p95, p99, max). Used by the tick
 * scheduler, RPC router, and DB layer to surface hot spots.
 */

export { Profiler } from './profiler'
export type { PerfStats, SampleKind } from './types'
