import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createJiti } from 'jiti'
import { type ProjectConfig, projectConfigSchema } from './project-schema'

/**
 * A module discovered under the project's `modules/` directory.
 */
export interface ResolvedModule {
	/** Module name (from package.json) */
	name: string
	/** Module version */
	version: string
	/** Absolute path to the module folder */
	path: string
	/** Relative path from the project root */
	relativePath: string
	/** Parsed package.json */
	packageJson: Record<string, unknown>
}

/**
 * The fully loaded project: validated config + discovered modules.
 */
export interface LoadedProject {
	/** Absolute path to the project root */
	rootDir: string
	/** Validated config from nextvm.config.ts */
	config: ProjectConfig
	/** Modules discovered under modules/* */
	modules: ResolvedModule[]
}

const CONFIG_FILENAMES = ['nextvm.config.ts', 'nextvm.config.js', 'nextvm.config.mjs']

/**
 * Load a NextVM project.
 *   1. Find nextvm.config.ts in the given directory (or current cwd)
 *   2. Load it via jiti (no compile step needed for TS)
 *   3. Validate the exported config against ProjectConfig schema
 *   4. Discover modules under modules/* via package.json
 * Throws on missing config, invalid TS, or schema violations.
 */
export async function loadProject(rootDir: string = process.cwd()): Promise<LoadedProject> {
	const root = resolve(rootDir)

	const configPath = findConfigFile(root)
	if (!configPath) {
		throw new Error(
			`No nextvm.config.{ts,js,mjs} found in ${root}. Run 'nextvm create <name>' to scaffold a new project.`,
		)
	}

	const rawConfig = await loadConfigFile(configPath)
	const result = projectConfigSchema.safeParse(rawConfig)
	if (!result.success) {
		throw new Error(
			`Invalid nextvm.config: ${result.error.issues
				.map((i) => `${i.path.join('.')}: ${i.message}`)
				.join(', ')}`,
		)
	}

	const config = result.data
	const modules = discoverModules(root, config.modules)

	return { rootDir: root, config, modules }
}

function findConfigFile(root: string): string | null {
	for (const name of CONFIG_FILENAMES) {
		const candidate = join(root, name)
		if (existsSync(candidate)) return candidate
	}
	return null
}

async function loadConfigFile(path: string): Promise<unknown> {
	const jiti = createJiti(dirname(path), { interopDefault: true })
	try {
		const mod = (await jiti.import(path, { default: true })) as unknown
		return mod
	} catch (err) {
		throw new Error(
			`Failed to load ${path}: ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

function discoverModules(root: string, allowList: string[]): ResolvedModule[] {
	const modulesDir = join(root, 'modules')
	if (!existsSync(modulesDir)) return []

	const entries = readdirSync(modulesDir).filter((name) => {
		const path = join(modulesDir, name)
		try {
			return statSync(path).isDirectory()
		} catch {
			return false
		}
	})

	const allowSet = allowList.length > 0 ? new Set(allowList) : null

	const modules: ResolvedModule[] = []
	for (const folder of entries) {
		const path = join(modulesDir, folder)
		const pkgPath = join(path, 'package.json')
		if (!existsSync(pkgPath)) continue

		let pkg: Record<string, unknown>
		try {
			pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>
		} catch (err) {
			throw new Error(
				`Failed to parse ${pkgPath}: ${err instanceof Error ? err.message : String(err)}`,
			)
		}

		const name = (pkg.name as string | undefined) ?? folder
		if (allowSet && !allowSet.has(name) && !allowSet.has(folder)) continue

		modules.push({
			name,
			version: (pkg.version as string | undefined) ?? '0.0.0',
			path,
			relativePath: join('modules', folder),
			packageJson: pkg,
		})
	}

	return modules
}
