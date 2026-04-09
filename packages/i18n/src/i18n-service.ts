import { interpolate } from './interpolate'
import type { Locale, LocaleBundle, LocaleMap, TranslationParams } from './types'

interface I18nServiceOptions {
	/** Default server locale (used as fallback layer 2) */
	defaultLocale?: Locale
	/** Logger callback for missing translations */
	onMissing?: (key: string, locale: Locale) => void
}

/**
 * I18nService — Translation registry and resolver.
 *
 * Concept v2.3, Chapter 14:
 *   - Modules register their locale bundles
 *   - Server resolves keys to player's locale
 *   - Fallback chain: player locale → server default → en → raw key (Chapter 14.5)
 *   - Missing translations logged as warnings, not silent
 *
 * GUARD-006 compliant: instance state, no globals.
 * GUARD-012 enforced: this is THE i18n system modules must use.
 */
export class I18nService {
	/** Map: locale → (key → template) */
	private locales = new Map<Locale, Map<string, string>>()
	/** Map: source → player locale (set by client report) */
	private playerLocales = new Map<number, Locale>()
	private defaultLocale: Locale
	private onMissing: (key: string, locale: Locale) => void

	constructor(opts: I18nServiceOptions = {}) {
		this.defaultLocale = opts.defaultLocale ?? 'en'
		this.onMissing = opts.onMissing ?? (() => {})
	}

	/**
	 * Register a locale bundle from a module.
	 * Concept 14.2: Modules ship locale files in shared/locales/<lang>.ts
	 */
	register(bundle: LocaleBundle): void {
		let map = this.locales.get(bundle.locale)
		if (!map) {
			map = new Map()
			this.locales.set(bundle.locale, map)
		}
		for (const [key, template] of Object.entries(bundle.translations)) {
			map.set(key, template)
		}
	}

	/** Register multiple bundles at once */
	registerAll(bundles: LocaleBundle[]): void {
		for (const bundle of bundles) this.register(bundle)
	}

	/**
	 * Bulk-register translations for a single module + locale.
	 * Convenience wrapper around register() that takes a plain map.
	 */
	registerTranslations(module: string, locale: Locale, translations: LocaleMap): void {
		this.register({ module, locale, translations })
	}

	/**
	 * Resolve a translation key for a specific player.
	 * Uses the player's reported locale, with the fallback chain (Chapter 14.5).
	 */
	t(source: number, key: string, params?: TranslationParams): string {
		const playerLocale = this.playerLocales.get(source) ?? this.defaultLocale
		return this.resolve(key, playerLocale, params)
	}

	/**
	 * Resolve a key for an explicit locale (no player context).
	 * Useful for server logs, admin commands, etc.
	 */
	translate(key: string, locale: Locale, params?: TranslationParams): string {
		return this.resolve(key, locale, params)
	}

	/** Set a player's reported locale (called when client connects) */
	setPlayerLocale(source: number, locale: Locale): void {
		this.playerLocales.set(source, locale)
	}

	/** Clear a player's locale (on disconnect) */
	clearPlayerLocale(source: number): void {
		this.playerLocales.delete(source)
	}

	/** Get the locale a player is currently using */
	getPlayerLocale(source: number): Locale {
		return this.playerLocales.get(source) ?? this.defaultLocale
	}

	/** List all registered locales */
	getRegisteredLocales(): Locale[] {
		return Array.from(this.locales.keys())
	}

	/** Check if a key exists in a given locale (no fallback) */
	hasKey(key: string, locale: Locale): boolean {
		return this.locales.get(locale)?.has(key) ?? false
	}

	/**
	 * Internal resolver implementing the fallback chain (Concept 14.5):
	 *   1. Try requested locale
	 *   2. Try server's default locale
	 *   3. Try English
	 *   4. Return raw key as fallback (and log warning)
	 */
	private resolve(key: string, locale: Locale, params?: TranslationParams): string {
		// Layer 1: requested locale
		const direct = this.locales.get(locale)?.get(key)
		if (direct !== undefined) {
			return interpolate(direct, params)
		}

		// Layer 2: server default
		if (locale !== this.defaultLocale) {
			const fallback1 = this.locales.get(this.defaultLocale)?.get(key)
			if (fallback1 !== undefined) {
				this.onMissing(key, locale)
				return interpolate(fallback1, params)
			}
		}

		// Layer 3: English
		if (locale !== 'en' && this.defaultLocale !== 'en') {
			const fallback2 = this.locales.get('en')?.get(key)
			if (fallback2 !== undefined) {
				this.onMissing(key, locale)
				return interpolate(fallback2, params)
			}
		}

		// Layer 4: raw key
		this.onMissing(key, locale)
		return key
	}
}
