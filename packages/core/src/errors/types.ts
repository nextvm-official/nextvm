/**
 * Error Boundary Types.
 *
 * Concept v2.3, Chapter 22.2:
 *   "A crashing module must not take down the server or other modules."
 */

/** Where the error originated */
export type ErrorOrigin =
	| 'lifecycle'
	| 'tick'
	| 'event-handler'
	| 'rpc-handler'
	| 'state-subscriber'

/** Error record stored in the error counter */
export interface ModuleErrorRecord {
	origin: ErrorOrigin
	handler: string
	message: string
	stack?: string
	timestamp: number
}

/** Module degradation status */
export interface ModuleDegradation {
	module: string
	degraded: boolean
	errorCount: number
	lastError: ModuleErrorRecord | null
	degradedAt: number | null
}
