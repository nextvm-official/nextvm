import type { ResolvedModule } from './project-loader'

/**
 * Generate the fxmanifest.lua content for a built module.
 *
 * Concept v2.3, Chapter 15.1:
 *   "Generate fxmanifest.lua from module definition"
 *
 * The manifest is the bridge between NextVM's TS module system and the
 * FXServer resource loader. We emit the standard `cerulean` manifest
 * with server + client entry points pointing at the tsup output.
 */

export interface FxmanifestOptions {
	/** Optional dependency list (other resources to ensure first) */
	dependencies?: string[]
	/** Whether the module ships server scripts (default: true) */
	hasServer?: boolean
	/** Whether the module ships client scripts (default: true) */
	hasClient?: boolean
	/** Whether to include lua54 'yes' (needed when wrapping with escrow) */
	requireLua54?: boolean
}

export function generateFxmanifest(
	module: ResolvedModule,
	opts: FxmanifestOptions = {},
): string {
	const hasServer = opts.hasServer ?? true
	const hasClient = opts.hasClient ?? true
	const description =
		(module.packageJson.description as string | undefined) ?? `${module.name} module`

	const lines: string[] = [
		"fx_version 'cerulean'",
		"games { 'gta5' }",
		`author 'NextVM'`,
		`description '${escapeSingleQuote(description)}'`,
		`version '${module.version}'`,
	]
	if (opts.requireLua54) lines.push("lua54 'yes'")
	lines.push('')

	if (hasServer) lines.push("server_script 'dist/server.js'")
	if (hasClient) lines.push("client_script 'dist/client.js'")
	lines.push('')

	lines.push("files {", "  'dist/**/*',", "  'locales/**/*',", '}', '')

	if (opts.dependencies && opts.dependencies.length > 0) {
		lines.push('dependencies {')
		for (const dep of opts.dependencies) {
			lines.push(`  '${escapeSingleQuote(dep)}',`)
		}
		lines.push('}', '')
	}

	return lines.join('\n')
}

function escapeSingleQuote(s: string): string {
	return s.replace(/'/g, "\\'")
}
