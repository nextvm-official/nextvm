import type { z, ZodTypeAny } from 'zod'
import type { AuthMiddleware, ProcedureDefinition, RpcContext } from './types'

/**
 * Procedure builder — fluent API to define a single RPC procedure.
 *   procedure
 *     .input(z.object({ accountId: z.string() }))
 *     .query(async ({ input, ctx }) => { ... })
 * The builder is a chain that progressively narrows types:
 *   - Start: no input, no auth
 *   - .input(schema): adds input type
 *   - .auth(middleware): adds auth check
 *   - .query() / .mutation(): finalizes with handler
 */

class ProcedureBuilder<TInput extends ZodTypeAny | null = null> {
	constructor(
		private readonly inputSchema: TInput,
		private readonly authMiddleware: AuthMiddleware | null,
	) {}

	/** Add Zod input validation */
	input<TNewInput extends ZodTypeAny>(schema: TNewInput): ProcedureBuilder<TNewInput> {
		return new ProcedureBuilder<TNewInput>(schema, this.authMiddleware)
	}

	/** Add authentication / authorization middleware (Kap. 10.3) */
	auth(middleware: AuthMiddleware): ProcedureBuilder<TInput> {
		return new ProcedureBuilder<TInput>(this.inputSchema, middleware)
	}

	/** Finalize as a read-only query procedure */
	query<TOutput>(
		handler: (args: {
			input: TInput extends ZodTypeAny ? z.infer<TInput> : undefined
			ctx: RpcContext
		}) => TOutput | Promise<TOutput>,
	): ProcedureDefinition<TInput extends null ? ZodTypeAny : TInput, TOutput> {
		return {
			type: 'query',
			inputSchema: this.inputSchema as ZodTypeAny | null,
			authMiddleware: this.authMiddleware,
			handler: handler as unknown as ProcedureDefinition['handler'],
		} as ProcedureDefinition<TInput extends null ? ZodTypeAny : TInput, TOutput>
	}

	/** Finalize as a write/mutation procedure */
	mutation<TOutput>(
		handler: (args: {
			input: TInput extends ZodTypeAny ? z.infer<TInput> : undefined
			ctx: RpcContext
		}) => TOutput | Promise<TOutput>,
	): ProcedureDefinition<TInput extends null ? ZodTypeAny : TInput, TOutput> {
		return {
			type: 'mutation',
			inputSchema: this.inputSchema as ZodTypeAny | null,
			authMiddleware: this.authMiddleware,
			handler: handler as unknown as ProcedureDefinition['handler'],
		} as ProcedureDefinition<TInput extends null ? ZodTypeAny : TInput, TOutput>
	}
}

/**
 * Entry point for defining a procedure.
 *   getBalance: procedure.input(...).query(...)
 */
export const procedure = new ProcedureBuilder<null>(null, null)
