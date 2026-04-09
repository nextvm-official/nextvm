/**
 * FiveM-backed ExportsApi.
 * Wraps the global `exports` proxy: each call assigns a function on
 * `exports[resource][name]`. Lives in the runtime layer (not in
 * @nextvm/compat) so the compat package stays buildable on plain Node
 * for tests.
 */

declare const exports: Record<string, Record<string, unknown>>

export class FivemExportsApi {
	register(resource: string, name: string, fn: (...args: unknown[]) => unknown): void {
		const slot = (exports[resource] ??= {})
		slot[name] = fn
	}
}
