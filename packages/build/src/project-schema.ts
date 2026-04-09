import { z } from 'zod'

/**
 * NextVM project configuration schema.
 *
 * Concept v2.3, Chapter 8 + 15:
 *   Each NextVM project has a `nextvm.config.ts` at the root that
 *   declares server settings, database connection, and the modules to
 *   load. Validated at startup so misconfiguration fails loudly.
 */

export const projectConfigSchema = z.object({
	server: z
		.object({
			name: z.string().min(1).default('NextVM Server'),
			maxPlayers: z.number().int().min(1).max(2048).default(32),
			defaultLocale: z.string().default('en'),
		})
		.default({}),
	database: z
		.object({
			host: z.string().default('localhost'),
			port: z.number().int().default(3306),
			user: z.string().default('root'),
			password: z.string().default(''),
			database: z.string().default('nextvm'),
		})
		.default({}),
	/**
	 * Module identifiers to enable.
	 * The build pipeline discovers everything under `<root>/modules/*`
	 * and only includes the entries listed here.
	 * An empty array means "include every module found".
	 */
	modules: z.array(z.string()).default([]),
})

export type ProjectConfig = z.infer<typeof projectConfigSchema>
