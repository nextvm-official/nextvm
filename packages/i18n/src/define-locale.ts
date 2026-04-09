import type { LocaleMap } from './types'

/**
 * Define a locale bundle with type inference.
 *   export default defineLocale({
 *     'weapon-shop.title': 'Weapon Shop',
 *     'weapon-shop.buy_confirm': 'Buy {weapon} for ${price}?',
 *   })
 * The returned object preserves the literal key types so other locales
 * can be type-checked against the base locale via SameKeys<T, U>.
 */
export function defineLocale<const T extends LocaleMap>(translations: T): T {
	return translations
}
