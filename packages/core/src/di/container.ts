import type { ModuleDefinition } from '../module/types'

/**
 * Dependency Injection Container.
 *
 * Concept v2.3, Chapter 8.2:
 *   "Modules never import each other directly. ctx.inject() provides typed access.
 *    The DI container resolves at startup, checks circular dependencies,
 *    and throws clear errors for missing modules."
 */
export class DIContainer {
	private modules = new Map<string, ModuleDefinition>()
	private resolved = new Map<string, unknown>()
	private resolving = new Set<string>()

	/** Register a module definition */
	register(definition: ModuleDefinition): void {
		if (this.modules.has(definition.name)) {
			throw new Error(`Module '${definition.name}' is already registered`)
		}
		this.modules.set(definition.name, definition)
	}

	/** Get a module's exports by name */
	inject<T = unknown>(name: string): T {
		const resolved = this.resolved.get(name)
		if (resolved !== undefined) {
			return resolved as T
		}

		if (!this.modules.has(name)) {
			throw new Error(
				`Module '${name}' not found. Available modules: ${Array.from(this.modules.keys()).join(', ')}`,
			)
		}

		return this.resolved.get(name) as T
	}

	/** Store a module's resolved exports */
	setResolved(name: string, exports: unknown): void {
		this.resolved.set(name, exports)
	}

	/**
	 * Resolve dependency order using topological sort.
	 * Detects circular dependencies and throws clear errors.
	 */
	resolveDependencyOrder(): string[] {
		const order: string[] = []
		const visited = new Set<string>()

		const visit = (name: string, path: string[]) => {
			if (this.resolving.has(name)) {
				throw new Error(
					`Circular dependency detected: ${[...path, name].join(' → ')}`,
				)
			}

			if (visited.has(name)) return

			this.resolving.add(name)

			const mod = this.modules.get(name)
			if (mod?.dependencies) {
				for (const dep of mod.dependencies) {
					if (!this.modules.has(dep)) {
						throw new Error(
							`Module '${name}' depends on '${dep}', but '${dep}' is not registered. Available modules: ${Array.from(this.modules.keys()).join(', ')}`,
						)
					}
					visit(dep, [...path, name])
				}
			}

			this.resolving.delete(name)
			visited.add(name)
			order.push(name)
		}

		for (const name of this.modules.keys()) {
			visit(name, [])
		}

		return order
	}

	/** Get a registered module definition */
	getModule(name: string): ModuleDefinition | undefined {
		return this.modules.get(name)
	}

	/** Get all registered module names */
	getModuleNames(): string[] {
		return Array.from(this.modules.keys())
	}

	/** Check if a module is registered */
	has(name: string): boolean {
		return this.modules.has(name)
	}
}
