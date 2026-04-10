import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pc from 'picocolors'
import { build as tsupBuild } from 'tsup'
import { generateFxmanifest } from './fxmanifest'
import { bundleLocales, type LocaleBundleResult } from './locale-bundler'
import type { LoadedProject, ResolvedModule } from './project-loader'

/**
 * Build orchestrator.
 *   nextvm build
 *     ├── TypeScript → JavaScript (tsup/esbuild)
 *     ├── Bundle per resource (server.js, client.js)
 *     ├── Generate fxmanifest.lua from module definition
 *     ├── Bundle locale files per module
 *     ├── Validate module deps, configs, locale completeness
 *     └── Output to dist/
 * For each discovered module:
 *   - Resolve server + client entry points
 *   - Run tsup to produce server.js / client.js bundles
 *   - Generate fxmanifest.lua next to dist/
 *   - Bundle locales into dist/locales/
 *   - Collect timings + warnings
 */

export interface BuildModuleResult {
	module: string
	durationMs: number
	bundledServer: boolean
	bundledClient: boolean
	locales: LocaleBundleResult
	warnings: string[]
}

export interface BuildResult {
	totalDurationMs: number
	modules: BuildModuleResult[]
	warnings: string[]
	errors: string[]
}

export interface BuildOptions {
	/** Print colored progress to stdout (default: true) */
	verbose?: boolean
	/** Skip locale bundling (faster dev rebuilds) */
	skipLocales?: boolean
}

export async function runBuild(
	project: LoadedProject,
	options: BuildOptions = {},
): Promise<BuildResult> {
	const verbose = options.verbose ?? true
	const start = Date.now()
	const result: BuildResult = {
		totalDurationMs: 0,
		modules: [],
		warnings: [],
		errors: [],
	}

	if (verbose) {
		console.log(pc.bold(pc.cyan(`\nBuilding ${project.modules.length} module(s)\n`)))
	}

	for (const mod of project.modules) {
		const modResult = await buildModule(mod, options)
		result.modules.push(modResult)
		result.warnings.push(...modResult.warnings)
		if (verbose) {
			const status = modResult.warnings.length > 0 ? pc.yellow('⚠') : pc.green('✓')
			console.log(
				`  ${status} ${pc.bold(mod.name)} ${pc.dim(`(${modResult.durationMs}ms)`)}`,
			)
			for (const w of modResult.warnings) {
				console.log(`    ${pc.yellow('⚠')} ${w}`)
			}
		}
	}

	result.totalDurationMs = Date.now() - start

	if (verbose) {
		console.log(
			`\n${pc.green('✓')} Built ${result.modules.length} module(s) in ${result.totalDurationMs}ms`,
		)
		if (result.warnings.length > 0) {
			console.log(pc.yellow(`  ${result.warnings.length} warning(s)`))
		}
	}

	return result
}

async function buildModule(
	module: ResolvedModule,
	options: BuildOptions,
): Promise<BuildModuleResult> {
	const start = Date.now()
	const warnings: string[] = []

	// Resolve entry points — modules either have one src/index.ts (split
	// internally) or split src/server/index.ts + src/client/index.ts.
	const serverEntry = pickEntry(module.path, [
		'src/server/index.ts',
		'src/index.ts',
	])
	const clientEntry = pickEntry(module.path, [
		'src/client/index.ts',
		'src/index.ts',
	])

	if (!serverEntry && !clientEntry) {
		warnings.push('no src/index.ts, src/server/index.ts, or src/client/index.ts found')
	}

	// FXServer runs two different JS environments:
	//   - Server: Node-like V8 isolate with CommonJS (module, require, exports)
	//   - Client: bare V8 isolate with NO module system (no module, no require)
	//
	// Server bundles use CJS. Client bundles use IIFE (wraps everything
	// in a self-executing function so no `module` global is needed).
	// Both inline every @nextvm/* package because there is no
	// node_modules tree inside a FiveM resource folder.
	const baseOpts = {
		clean: false,
		sourcemap: true,
		dts: false,
		silent: true,
		outExtension: () => ({ js: '.js' }),
		noExternal: [/^@nextvm\//],
	}
	const serverTsupOpts = { ...baseOpts, format: ['cjs' as const] }
	const clientTsupOpts = { ...baseOpts, format: ['iife' as const] }

	// Externals: things FXServer provides at runtime, plus native modules
	// that can't be bundled. @nextvm/* are intentionally NOT external —
	// they get inlined into each resource bundle.
	const SERVER_EXTERNAL = [
		'@citizenfx/server',
		'mysql2',
		'mysql2/promise',
		'discord.js',
	]
	const CLIENT_EXTERNAL = ['@citizenfx/client']

	// Build server bundle (CJS — Node-like environment)
	let bundledServer = false
	if (serverEntry) {
		await tsupBuild({
			...serverTsupOpts,
			entry: { server: serverEntry },
			outDir: join(module.path, 'dist'),
			external: SERVER_EXTERNAL,
		})
		bundledServer = true
	}

	// Build client bundle (IIFE — bare V8, no module system)
	let bundledClient = false
	if (clientEntry && clientEntry !== serverEntry) {
		await tsupBuild({
			...clientTsupOpts,
			entry: { client: clientEntry },
			outDir: join(module.path, 'dist'),
			external: CLIENT_EXTERNAL,
		})
		bundledClient = true
	} else if (serverEntry) {
		// Single-bundle mode: build a second pass with the same entry but
		// renamed as 'client' so fxmanifest can reference dist/client.js.
		await tsupBuild({
			...clientTsupOpts,
			entry: { client: serverEntry },
			outDir: join(module.path, 'dist'),
			external: CLIENT_EXTERNAL,
		})
		bundledClient = true
	}

	// Generate fxmanifest.lua
	const manifestPath = join(module.path, 'fxmanifest.lua')
	const manifest = generateFxmanifest(module, {
		hasServer: bundledServer,
		hasClient: bundledClient,
	})
	writeFileSync(manifestPath, manifest)

	// Bundle locales
	let locales: LocaleBundleResult = {
		module: module.name,
		bundled: [],
		missingKeys: [],
	}
	if (!options.skipLocales) {
		locales = bundleLocales(module)
		for (const missing of locales.missingKeys) {
			warnings.push(`locale '${missing.locale}' missing key '${missing.key}'`)
		}
	}

	return {
		module: module.name,
		durationMs: Date.now() - start,
		bundledServer,
		bundledClient,
		locales,
		warnings,
	}
}

function pickEntry(modulePath: string, candidates: string[]): string | null {
	for (const rel of candidates) {
		const path = join(modulePath, rel)
		if (existsSync(path)) return path
	}
	return null
}
