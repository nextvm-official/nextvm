import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bundleLocales } from '../src'
import type { ResolvedModule } from '../src'

describe('bundleLocales', () => {
	let root: string
	let mod: ResolvedModule

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'nextvm-locale-'))
		mod = {
			name: '@nextvm/test',
			version: '0.0.1',
			path: root,
			relativePath: 'test',
			packageJson: {},
		}
	})

	afterEach(() => {
		rmSync(root, { recursive: true, force: true })
	})

	const writeLocale = (lang: string, body: string) => {
		const dir = join(root, 'src', 'shared', 'locales')
		mkdirSync(dir, { recursive: true })
		writeFileSync(join(dir, `${lang}.ts`), body)
	}

	it('returns empty result when no locales directory exists', () => {
		const result = bundleLocales(mod)
		expect(result.bundled).toEqual([])
	})

	it('extracts a flat key/value map and writes JSON', () => {
		writeLocale(
			'en',
			`import { defineLocale } from '@nextvm/i18n'
export default defineLocale({
  'shop.title': 'Weapon Shop',
  'shop.buy': 'Buy {weapon} for {price}?',
})`,
		)
		const result = bundleLocales(mod)
		expect(result.bundled).toHaveLength(1)
		expect(result.bundled[0]?.locale).toBe('en')
		expect(result.bundled[0]?.keys).toBe(2)

		const json = JSON.parse(
			readFileSync(join(root, 'dist', 'locales', 'en.json'), 'utf-8'),
		) as Record<string, string>
		expect(json['shop.title']).toBe('Weapon Shop')
		expect(json['shop.buy']).toBe('Buy {weapon} for {price}?')
	})

	it('reports missing keys against the en base locale', () => {
		writeLocale(
			'en',
			`export default defineLocale({
  'a': 'A',
  'b': 'B',
})`,
		)
		writeLocale(
			'de',
			`export default defineLocale({
  'a': 'A-de',
})`,
		)
		const result = bundleLocales(mod)
		expect(result.bundled).toHaveLength(2)
		expect(result.missingKeys).toContainEqual({ locale: 'de', key: 'b' })
	})

	it('does not flag missing keys when both locales are complete', () => {
		writeLocale('en', `export default defineLocale({ 'a': 'A' })`)
		writeLocale('de', `export default defineLocale({ 'a': 'A-de' })`)
		const result = bundleLocales(mod)
		expect(result.missingKeys).toEqual([])
	})
})
