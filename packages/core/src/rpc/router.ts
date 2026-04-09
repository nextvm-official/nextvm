import { createLogger } from '../logger/logger'
import type { Profiler } from '../performance/profiler'
import { RateLimiter } from './rate-limiter'
import {
	type ProcedureDefinition,
	type RpcContext,
	type RpcEncryptionAdapter,
	RpcError,
	type Router,
} from './types'

/**
 * RpcRouter — Server-side dispatcher for all registered RPC procedures.
 *   - Receives requests from clients
 *   - Validates input via Zod
 *   - Runs auth middleware
 *   - Rate-limits per player (Kap. 10.3)
 *   - Injects framework-controlled context (source NOT spoofable)
 *   - Routes to the right procedure handler
 *   - Returns typed result or RpcError
 */
/**
 * Optional error reporter — receives module-attributed errors from RPC handlers.
 * Set by the framework to wire RPC errors into the error boundary.
 */
export type RpcErrorReporter = (
	module: string,
	procedureName: string,
	error: unknown,
) => void

export class RpcRouter {
	private routers = new Map<string, Router>()
	private rateLimiter: RateLimiter
	private encryption: RpcEncryptionAdapter | null = null
	private getCharId: ((source: number) => number | null) | null = null
	private errorReporter: RpcErrorReporter | null = null
	private profiler: Profiler | null = null
	private log = createLogger('nextvm:rpc')

	constructor(opts?: { rateLimiter?: RateLimiter }) {
		this.rateLimiter = opts?.rateLimiter ?? new RateLimiter()
	}

	/**
	 * Set the error reporter — called by the framework to wire RPC errors
	 * into the module error boundary.
	 */
	setErrorReporter(reporter: RpcErrorReporter | null): void {
		this.errorReporter = reporter
	}

	/**
	 * Wire up a profiler so RPC handler durations are sampled.
	 * Each call records `rpc:<namespace>:<procedure>` with the wall time
	 * of the handler (excluding validation + auth + rate-limit overhead).
	 */
	setProfiler(profiler: Profiler): void {
		this.profiler = profiler
	}

	/** Register a router under a namespace (e.g., 'banking') */
	register(namespace: string, router: Router): void {
		if (this.routers.has(namespace)) {
			throw new Error(`RPC namespace '${namespace}' is already registered`)
		}
		this.routers.set(namespace, router)
	}

	/** Set the encryption adapter (used by anti-cheat integrations, Kap. 20.2.3) */
	setEncryptionAdapter(adapter: RpcEncryptionAdapter | null): void {
		this.encryption = adapter
	}

	/** Set the function used to resolve a source ID to a character ID */
	setCharIdResolver(resolver: (source: number) => number | null): void {
		this.getCharId = resolver
	}

	/**
	 * Dispatch an incoming RPC call.
	 * Called by the network layer when a client sends an RPC request.
	 * The framework guarantees that `source` comes from the secure
	 * server-side player table, NOT from client payload (Kap. 10.3).
	 */
	async dispatch(
		source: number,
		namespace: string,
		procedureName: string,
		rawInput: unknown,
	): Promise<unknown> {
		const router = this.routers.get(namespace)
		if (!router) {
			throw new RpcError('NOT_FOUND', `RPC namespace '${namespace}' not found`)
		}

		const procedure = router[procedureName]
		if (!procedure) {
			throw new RpcError(
				'NOT_FOUND',
				`Procedure '${namespace}.${procedureName}' not found`,
			)
		}

		// 1. Rate limit (Kap. 10.3)
		const procedureKey = `${namespace}.${procedureName}`
		if (!this.rateLimiter.tryConsume(source, procedureKey)) {
			this.log.warn('Rate limit exceeded', { source, procedure: procedureKey })
			throw new RpcError('RATE_LIMITED', 'Too many requests')
		}

		// 2. Decrypt payload if encryption adapter is set
		let input: unknown = rawInput
		if (this.encryption) {
			try {
				input = this.encryption.decrypt(rawInput, source)
			} catch (err) {
				throw new RpcError('VALIDATION_ERROR', 'Failed to decrypt RPC payload', err)
			}
		}

		// 3. Validate input via Zod
		let validatedInput: unknown = undefined
		if (procedure.inputSchema) {
			const result = procedure.inputSchema.safeParse(input)
			if (!result.success) {
				throw new RpcError(
					'VALIDATION_ERROR',
					'Invalid RPC input',
					result.error.issues,
				)
			}
			validatedInput = result.data
		}

		// 4. Build framework-controlled context (source is NOT spoofable)
		const ctx: RpcContext = {
			source,
			charId: this.getCharId?.(source) ?? null,
			module: namespace,
		}

		// 5. Run auth middleware (Kap. 10.3)
		if (procedure.authMiddleware) {
			let allowed = false
			try {
				allowed = await procedure.authMiddleware(ctx)
			} catch (err) {
				throw new RpcError(
					'AUTH_ERROR',
					'Auth middleware threw',
					err instanceof Error ? err.message : String(err),
				)
			}
			if (!allowed) {
				throw new RpcError('AUTH_ERROR', 'Permission denied')
			}
		}

		// 6. Run the actual handler (profiled)
		const handlerStart = Date.now()
		try {
			const result = await procedure.handler({
				input: validatedInput as never,
				ctx,
			})
			this.profiler?.record('rpc', namespace, procedureName, Date.now() - handlerStart)
			return result
		} catch (err) {
			this.profiler?.record('rpc', namespace, procedureName, Date.now() - handlerStart)
			if (err instanceof RpcError) throw err
			this.log.error('RPC handler threw', {
				procedure: procedureKey,
				source,
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
			})
			// Report to error boundary so module degradation triggers
			// when RPC handlers throw too often
			this.errorReporter?.(namespace, procedureName, err)
			throw new RpcError(
				'INTERNAL_ERROR',
				'Internal server error',
				err instanceof Error ? err.message : String(err),
			)
		}
	}

	/** Clear rate limit state for a player (call on disconnect) */
	onPlayerDisconnect(source: number): void {
		this.rateLimiter.clearPlayer(source)
	}

	/** Get all registered namespaces */
	getNamespaces(): string[] {
		return Array.from(this.routers.keys())
	}

	/** Check if a procedure exists (used by client transport) */
	hasProcedure(namespace: string, procedureName: string): boolean {
		const router = this.routers.get(namespace)
		if (!router) return false
		return procedureName in router
	}

	/** Get a procedure definition (for introspection / docs) */
	getProcedure(namespace: string, procedureName: string): ProcedureDefinition | undefined {
		return this.routers.get(namespace)?.[procedureName]
	}
}
