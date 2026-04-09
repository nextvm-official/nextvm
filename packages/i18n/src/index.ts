/**
 * @nextvm/i18n — NextVM Internationalization System
 *   - Typed translation keys
 *   - Per-player locale
 *   - Module-defined locale bundles
 *   - Fallback chain: player → server default → en → raw key
 * Usage:
 *   import { I18nService, defineLocale } from '@nextvm/i18n'
 *   const en = defineLocale({
 *     'weapon-shop.title': 'Weapon Shop',
 *     'weapon-shop.buy': 'Buy {weapon} for ${price}?',
 *   })
 *   const i18n = new I18nService({ defaultLocale: 'en' })
 *   i18n.registerTranslations('weapon-shop', 'en', en)
 *   i18n.t(source, 'weapon-shop.buy', { weapon: 'Pistol', price: 500 })
 */

export { I18nService } from './i18n-service'
export { interpolate } from './interpolate'
export { defineLocale } from './define-locale'
export type {
	Locale,
	LocaleMap,
	LocaleBundle,
	TranslationParams,
	TranslatableNotification,
	SameKeys,
} from './types'
