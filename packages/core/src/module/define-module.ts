import type { ZodRawShape } from 'zod'
import type { ModuleDefinition } from './types'

/**
 * Define a NextVM module.
 * This is the main entry point for creating modules.
 * The returned definition is used by the framework to
 * register, validate, and initialize the module.
 */
export function defineModule<TConfig extends ZodRawShape>(
	definition: ModuleDefinition<TConfig>,
): ModuleDefinition<TConfig> {
	return definition
}
