/**
 * @nextvm/i18n — NextVM Internationalization System
 *
 * Concept v2.3, Chapter 14:
 *   - Typed translation keys (Chapter 14.4)
 *   - Per-player locale (Chapter 14.1)
 *   - Module-defined locale bundles (Chapter 14.2)
 *   - Fallback chain: player → server default → en → raw key (Chapter 14.5)
 *   - GUARD-012 enforcement: user-facing strings must use translation keys
 *
 * Usage:
 *   import { I18nService, defineLocale } from '@nextvm/i18n'
 *
 *   const en = defineLocale({
 *     'weapon-shop.title': 'Weapon Shop',
 *     'weapon-shop.buy': 'Buy {weapon} for ${price}?',
 *   })
 *
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
