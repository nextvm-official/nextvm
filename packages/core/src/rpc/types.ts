import type { z, ZodTypeAny } from 'zod'

/**
 * RPC Types.
 * Inspired by tRPC: compile-time type-safe remote procedure calls.
 * No string-based TriggerServerEvent.
 */

/** Request context passed to every procedure handler */
export interface RpcContext {
	/** Player source ID — injected by framework, NOT spoofable (Kap. 10.3) */
	source: number
	/** Character ID for the calling player (if a character is selected) */
	charId: number | null
	/** Module name handling this request */
	module: string
}

/** Procedure types */
export type ProcedureType = 'query' | 'mutation'

/** Auth middleware — return true to allow, false/throw to deny */
export type AuthMiddleware = (ctx: RpcContext) => boolean | Promise<boolean>

/** Internal procedure definition (after .input/.query/.mutation) */
export interface ProcedureDefinition<
	TInput extends ZodTypeAny = ZodTypeAny,
	TOutput = unknown,
> {
	type: ProcedureType
	inputSchema: TInput | null
	authMiddleware: AuthMiddleware | null
	handler: (args: {
		input: TInput extends ZodTypeAny ? z.infer<TInput> : undefined
		ctx: RpcContext
	}) => TOutput | Promise<TOutput>
}

/** A router is a record of named procedures */
export type Router = Record<string, ProcedureDefinition>

/** Type-level helper to extract the input type of a procedure */
export type InferInput<P> = P extends ProcedureDefinition<infer I, unknown>
	? I extends ZodTypeAny
		? z.infer<I>
		: undefined
	: never

/** Type-level helper to extract the output type of a procedure */
export type InferOutput<P> = P extends ProcedureDefinition<ZodTypeAny, infer O>
	? Awaited<O>
	: never

/**
 * Client-facing router type:
 * Transforms server router into a typed client API.
 *   { getBalance: procedure } → { getBalance: (input) => Promise<output> }
 */
export type ClientRouter<TRouter extends Router> = {
	[K in keyof TRouter]: TRouter[K] extends ProcedureDefinition<infer I, infer O>
		? I extends ZodTypeAny
			? (input: z.infer<I>) => Promise<Awaited<O>>
			: () => Promise<Awaited<O>>
		: never
}

/** RPC error codes */
export type RpcErrorCode =
	| 'VALIDATION_ERROR'
	| 'AUTH_ERROR'
	| 'NOT_FOUND'
	| 'RATE_LIMITED'
	| 'INTERNAL_ERROR'

/** Structured RPC error */
export class RpcError extends Error {
	constructor(
		public readonly code: RpcErrorCode,
		message: string,
		public readonly details?: unknown,
	) {
		super(message)
		this.name = 'RpcError'
	}
}

/** Encryption adapter for AC integration (Kap. 20.2.3) */
export interface RpcEncryptionAdapter {
	encrypt: (payload: unknown, source: number) => unknown
	decrypt: (payload: unknown, source: number) => unknown
}
