import { z, type ZodRawShape } from 'zod'
import { StateStore } from './state-store'
import type { StateBackend } from './types'

/**
 * Define a typed state container.
 *
 * Concept v2.3, Chapter 11:
 *   export const playerState = defineState('player', {
 *     job: z.string().default('unemployed'),
 *     cash: z.number().default(0),
 *     bank: z.number().default(500),
 *     isDead: z.boolean().default(false),
 *   })
 *
 * The returned StateStore is character-scoped (GUARD-011) and validated
 * against the Zod schema on every write (GUARD-005).
 */
export function defineState<TShape extends ZodRawShape>(
	name: string,
	shape: TShape,
	options?: { backend?: StateBackend },
): StateStore<TShape> {
	return new StateStore<TShape>(name, z.object(shape), options?.backend ?? null)
}
