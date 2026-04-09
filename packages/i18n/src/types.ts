/**
 * i18n Types.
 * Locale codes follow ISO 639-1 (e.g., 'en', 'de', 'fr', 'es', 'pt-BR', 'pl', 'ru').
 */

/** Locale code (ISO 639-1, optionally with region) */
export type Locale = string

/** A flat map of translation keys to template strings */
export type LocaleMap = Readonly<Record<string, string>>

/**
 * Type-safe locale enforcement (Concept 14.4):
 * Given a base locale (usually en), other locales must have the same keys.
 * Use: type DeLocale = SameKeys<typeof en, typeof de>
 */
export type SameKeys<Base extends LocaleMap, Other extends LocaleMap> =
	keyof Base extends keyof Other
		? keyof Other extends keyof Base
			? Other
			: never
		: never

/** Parameters for template interpolation: {paramName} placeholders */
export type TranslationParams = Record<string, string | number>

/** Notification payload sent from server to client (Concept 14.3) */
export interface TranslatableNotification {
	key: string
	params?: TranslationParams
	type?: 'info' | 'success' | 'warning' | 'error'
}

/** A registered locale bundle from a module */
export interface LocaleBundle {
	module: string
	locale: Locale
	translations: LocaleMap
}
