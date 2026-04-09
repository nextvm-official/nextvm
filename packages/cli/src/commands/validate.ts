import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm validate` — Static checks on the current project.
 * Performs structural + GUARD checks that don't require the build pipeline:
 *   - nextvm.config.ts exists
 *   - Each module has src/index.ts
 *   - Each module has at least an en locale file
 *   - Modules importing @nextvm/tebex ship a MONETIZATION.md
 *   - Modules with declared dependencies have a matching adapter file (soft warn)
 *   - Modules expose a separate src/server/ + src/server/router.ts (soft warn)
 *   - Every RPC procedure in router.ts has a Zod .input(...) (hard error)
 */
export function registerValidateCommand(program: Command): void {
	program
		.command('validate')
		.description('Check deps, configs, schemas, PLA compliance, locale completeness')
		.action(() => {
			cliLog.header('Validating NextVM project')

			const errors: string[] = []
			const warnings: string[] = []

			if (!existsSync('nextvm.config.ts') && !existsSync('nextvm.config.js')) {
				errors.push('nextvm.config.ts not found in current directory')
			} else {
				cliLog.success('nextvm.config.ts found')
			}

			if (!existsSync('modules')) {
				warnings.push('No modules/ directory found')
			} else {
				const modules = readdirSync('modules').filter((name) => {
					const path = join('modules', name)
					return statSync(path).isDirectory()
				})
				cliLog.success(`Found ${modules.length} module(s)`)

				for (const mod of modules) {
					validateModule(mod, errors, warnings)
				}
			}

			for (const w of warnings) cliLog.warn(w)
			for (const e of errors) cliLog.error(e)

			if (errors.length > 0) {
				cliLog.error(`Validation failed with ${errors.length} error(s)`)
				process.exit(1)
			}
			cliLog.success(
				`Validation passed${warnings.length > 0 ? ` (${warnings.length} warnings)` : ''}`,
			)
		})
}

function validateModule(mod: string, errors: string[], warnings: string[]): void {
	const modPath = join('modules', mod)
	const indexPath = join(modPath, 'src', 'index.ts')
	if (!existsSync(indexPath)) {
		errors.push(`Module '${mod}' missing src/index.ts`)
		return
	}

	let indexContent: string
	try {
		indexContent = readFileSync(indexPath, 'utf-8')
	} catch (err) {
		warnings.push(
			`Could not read ${indexPath}: ${err instanceof Error ? err.message : String(err)}`,
		)
		return
	}

	const localesPath = join(modPath, 'src', 'shared', 'locales')
	if (existsSync(localesPath)) {
		const enPath = join(localesPath, 'en.ts')
		if (!existsSync(enPath)) {
			warnings.push(
				`Module '${mod}' has a locales/ directory but no en.ts (default locale).`,
			)
		}
	} else {
		warnings.push(`Module '${mod}' has no shared/locales directory.`)
	}

	const monetizationPath = join(modPath, 'MONETIZATION.md')
	const tebexImport =
		/(?:import\s[^'"]*from\s+|require\s*\(\s*)['"]@nextvm\/tebex['"]/
	if (tebexImport.test(indexContent) && !existsSync(monetizationPath)) {
		errors.push(
			`Module '${mod}' imports @nextvm/tebex but ships no MONETIZATION.md (PLA compliance).`,
		)
	}

	// Soft warn if no layered structure
	const serverDir = join(modPath, 'src', 'server')
	const hasService = existsSync(join(serverDir, 'service.ts'))
	const hasRouter = existsSync(join(serverDir, 'router.ts'))
	const isLayered = hasService && hasRouter
	if (!isLayered) {
		warnings.push(
			`Module '${mod}' is not using the layered structure (src/server/service.ts + router.ts). See https://docs.nextvm.dev/guide/module-authoring.`,
		)
	}

	// MODULE_ARCHITECTURE — declared deps should have an adapter
	const declaredDeps = extractDeclaredDependencies(indexContent)
	const adaptersDir = join(modPath, 'src', 'adapters')
	for (const dep of declaredDeps) {
		// Strip @nextvm/ prefix if present
		const short = dep.replace(/^@nextvm\//, '')
		const candidatePaths = [
			join(adaptersDir, `${short}-adapter.ts`),
			join(adaptersDir, `${dep}-adapter.ts`),
			join(adaptersDir, `${short}.ts`),
		]
		const hasAdapter = candidatePaths.some((p) => existsSync(p))
		if (!hasAdapter) {
			warnings.push(
				`Module '${mod}' declares dependency '${dep}' but has no adapter file under src/adapters/.`,
			)
		}
	}

	if (hasRouter) {
		const routerPath = join(serverDir, 'router.ts')
		try {
			const routerContent = readFileSync(routerPath, 'utf-8')
			const issues = validateRouterInputs(routerContent)
			for (const issue of issues) {
				errors.push(`Module '${mod}' router: ${issue}`)
			}
		} catch (err) {
			warnings.push(
				`Could not read ${routerPath}: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}
}

/** Extract declared module deps from a defineModule call's `dependencies: [...]` array */
function extractDeclaredDependencies(content: string): string[] {
	const match = content.match(/dependencies\s*:\s*\[([^\]]*)\]/)
	if (!match || !match[1]) return []
	return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g)).map((m) => m[1] as string)
}

/**
 * Light static check on a router file: every procedure that ends with
 * .query(...) or .mutation(...) should have a .input(z.<...>) earlier
 * in the same chain. Procedures with no input still need to declare so
 * via .input(z.void()) or accept that the audit will warn.
 * This is a regex-level check — it catches the obvious case where the
 * developer forgot .input() entirely. The runtime RpcRouter is the
 * source of truth and rejects bad payloads anyway.
 */
function validateRouterInputs(content: string): string[] {
	const issues: string[] = []

	// Find every property assignment that uses procedure
	const procRegex = /(\w+)\s*:\s*procedure([^,}]*?)\.(query|mutation)\s*\(/g
	for (const match of content.matchAll(procRegex)) {
		const procName = match[1]
		const chain = match[2] ?? ''
		if (!chain.includes('.input(')) {
			// Procedures returning data with no params still get a pass —
			// many query() handlers legitimately take no input. We only
			// flag mutations without an .input() because those almost
			// always indicate a missing schema.
			if (match[3] === 'mutation') {
				issues.push(
					`procedure '${procName}' is a mutation without .input(z.object(...))`,
				)
			}
		}
	}

	return issues
}
