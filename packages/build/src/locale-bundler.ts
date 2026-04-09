import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ResolvedModule } from './project-loader'

/**
 * Locale bundler.
 *
 * Concept v2.3, Chapter 14 + 15.1:
 *   "Bundle locale files per module"
 *
 * Reads `<module>/src/shared/locales/*.ts` (the source files that
 * use defineLocale()), extracts their default-exported translation maps,
 * and emits them as JSON under `<module>/dist/locales/<lang>.json`.
 *
 * The TS files themselves are too dynamic to parse statically, so we
 * use a regex-based extractor that supports the 95% case (an object
 * literal returned from defineLocale). Modules with computed locales
 * can ship their own runtime helper.
 */

export interface BundledLocale {
	locale: string
	keys: number
	path: string
}

export interface LocaleBundleResult {
	module: string
	bundled: BundledLocale[]
	missingKeys: Array<{ locale: string; key: string }>
}

const KEY_VALUE_REGEX = /['"]([^'"]+)['"]\s*:\s*['"]((?:[^'"\\]|\\.)*)['"]/g

export function bundleLocales(module: ResolvedModule): LocaleBundleResult {
	const result: LocaleBundleResult = {
		module: module.name,
		bundled: [],
		missingKeys: [],
	}

	const localesDir = join(module.path, 'src', 'shared', 'locales')
	if (!existsSync(localesDir)) return result

	const localeFiles = readdirSync(localesDir).filter((f) => f.endsWith('.ts'))
	if (localeFiles.length === 0) return result

	const outDir = join(module.path, 'dist', 'locales')
	mkdirSync(outDir, { recursive: true })

	const allLocales = new Map<string, Record<string, string>>()
	for (const file of localeFiles) {
		const locale = basename(file, '.ts')
		const content = readFileSync(join(localesDir, file), 'utf-8')
		const map = parseLocaleFile(content)
		allLocales.set(locale, map)

		const outPath = join(outDir, `${locale}.json`)
		writeFileSync(outPath, JSON.stringify(map, null, 2))
		result.bundled.push({
			locale,
			keys: Object.keys(map).length,
			path: outPath,
		})
	}

	// Validate completeness against the base locale (en if present, else first)
	const baseName = allLocales.has('en') ? 'en' : (allLocales.keys().next().value as string | undefined)
	if (baseName) {
		const base = allLocales.get(baseName)!
		const baseKeys = new Set(Object.keys(base))
		for (const [locale, map] of allLocales) {
			if (locale === baseName) continue
			for (const key of baseKeys) {
				if (!(key in map)) {
					result.missingKeys.push({ locale, key })
				}
			}
		}
	}

	return result
}

/**
 * Extract a flat key→string map from a locale file.
 *
 * Limitation: only handles flat object literals like
 *   export default defineLocale({ 'a': 'b', 'c': 'd' })
 * This covers the official module template (Concept Chapter 14.2).
 */
function parseLocaleFile(content: string): Record<string, string> {
	const map: Record<string, string> = {}
	for (const match of content.matchAll(KEY_VALUE_REGEX)) {
		const [, key, value] = match
		if (key && value !== undefined) {
			map[key] = value.replace(/\\'/g, "'").replace(/\\"/g, '"')
		}
	}
	return map
}
