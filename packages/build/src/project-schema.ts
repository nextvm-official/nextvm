import { z } from 'zod'

/**
 * NextVM project configuration schema.
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
	/**
	 * Optional FXServer subprocess configuration. When present, the
	 * `nextvm serve` and `nextvm dev --serve` commands will spawn a
	 * local FXServer process pointed at this artifact directory.
	 */
	fxserver: z
		.object({
			/** Absolute path to a downloaded FXServer artifact directory (containing FXServer.exe / run.sh) */
			path: z.string().min(1),
			/**
			 * Optional path to the data directory containing `resources/`.
			 * Only set this for split layouts (server/ + server-data/).
			 * Defaults to `path` for the all-in-one artifact layout.
			 */
			dataPath: z.string().optional(),
			/** Optional Cfx.re license key (overrides $CFX_LICENSE_KEY env var) */
			licenseKey: z.string().optional(),
			/** sv_enforceGameBuild (defaults to 3095) */
			gameBuild: z.number().int().optional(),
			/** Bind endpoint, defaults to 0.0.0.0:30120 */
			endpoint: z.string().default('0.0.0.0:30120'),
			/** Extra resources to ensure after framework modules */
			additionalResources: z.array(z.string()).default([]),
			/** Raw `set <k> <v>` convars */
			convars: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
		})
		.optional(),
})

export type ProjectConfig = z.infer<typeof projectConfigSchema>
