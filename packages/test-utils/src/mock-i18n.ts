/**
 * Tiny in-memory i18n stub for tests that don't need the full
 * @nextvm/i18n package wired up.
 * Usage:
 *   const i18n = createMockI18n({ en: { 'foo.bar': 'Hello {name}' } })
 *   i18n.t('foo.bar', { name: 'Tom' }) // → 'Hello Tom'
 */

export interface MockI18n {
	t(key: string, params?: Record<string, string | number>): string
	setLocale(locale: string): void
	getLocale(): string
}

export interface MockI18nOptions {
	locale?: string
	bundles?: Record<string, Record<string, string>>
}

export function createMockI18n(options: MockI18nOptions = {}): MockI18n {
	let currentLocale = options.locale ?? 'en'
	const bundles = options.bundles ?? {}

	const interpolate = (template: string, params?: Record<string, string | number>) => {
		if (!params) return template
		return template.replace(/\$?\{(\w+)\}/g, (match, key: string) =>
			key in params ? String(params[key]) : match,
		)
	}

	return {
		t(key, params) {
			const bundle = bundles[currentLocale] ?? {}
			const template = bundle[key]
			if (template === undefined) return key
			return interpolate(template, params)
		},
		setLocale(locale) {
			currentLocale = locale
		},
		getLocale() {
			return currentLocale
		},
	}
}
