import type { TranslationParams } from './types'

/**
 * Interpolate {paramName} placeholders in a template string.
 *   'Buy {weapon} for ${price}?' + { weapon: 'Pistol', price: 500 }
 *   → 'Buy Pistol for $500?'
 * Note: Both {name} and ${name} syntax are supported, but {name} is preferred.
 */
export function interpolate(template: string, params?: TranslationParams): string {
	if (!params) return template

	return template.replace(/\$?\{(\w+)\}/g, (match, key: string) => {
		const value = params[key]
		if (value === undefined) {
			// Leave placeholder intact if param missing — caller can detect
			return match
		}
		return String(value)
	})
}
