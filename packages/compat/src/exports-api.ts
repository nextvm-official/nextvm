import type { ExportsApi } from './types'

/**
 * In-memory ExportsApi implementation — used for tests and any context
 * outside the FiveM server runtime.
 *
 * The real FiveM-backed implementation lives in the server bootstrap
 * layer (it calls the global `exports[resource][name] = fn` pattern).
 * Keeping the FiveM-specific implementation out of this package makes
 * @nextvm/compat buildable and testable on plain Node.
 */
export class InMemoryExportsApi implements ExportsApi {
	private registry = new Map<string, Map<string, (...args: unknown[]) => unknown>>()

	register(resource: string, name: string, fn: (...args: unknown[]) => unknown): void {
		let resourceMap = this.registry.get(resource)
		if (!resourceMap) {
			resourceMap = new Map()
			this.registry.set(resource, resourceMap)
		}
		resourceMap.set(name, fn)
	}

	/** Test helper: invoke a registered export by name */
	call(resource: string, name: string, ...args: unknown[]): unknown {
		const fn = this.registry.get(resource)?.get(name)
		if (!fn) throw new Error(`Export ${resource}:${name} not registered`)
		return fn(...args)
	}

	/** Get all registered resources */
	getResources(): string[] {
		return Array.from(this.registry.keys())
	}
}
