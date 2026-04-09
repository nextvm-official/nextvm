/**
 * useNative — Escape hatch for direct FiveM native access.
 *   "useNative() for typed direct native access ... Each escape hatch
 *    requires benchmark justification."
 * comment that justifies the bypass with measured numbers, e.g.:
 *   // : useNative — measured 18% faster than NextVMEntity
 *   // wrapper for tight inner loop (1000 entities/frame).
 *   // Benchmark: scripts/bench/entity-loop.ts
 *   const coords = useNative<[number, number, number]>('GetEntityCoords', handle, true)
 * The wrapped function is resolved from the global FiveM scope at call
 * time. If the global is not present (tests, non-FiveM Node), the call
 * throws a clear error so misuse is loud rather than silent.
 */
export function useNative<T = unknown>(name: string, ...args: unknown[]): T {
	const fn = (globalThis as Record<string, unknown>)[name]
	if (typeof fn !== 'function') {
		throw new Error(
			`useNative('${name}') called but no global '${name}' is available. ` +
				`This usually means you ran NextVM outside the FiveM runtime, or the ` +
				`native name is misspelled.`,
		)
	}
	return (fn as (...a: unknown[]) => T)(...args)
}
