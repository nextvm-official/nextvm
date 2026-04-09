import { describe, expect, it } from 'vitest'
import { defineLocale, I18nService, interpolate } from '../src'

describe('interpolate', () => {
	it('replaces {key} placeholders', () => {
		expect(interpolate('Hello {name}', { name: 'Tom' })).toBe('Hello Tom')
	})

	it('also handles ${key} variant', () => {
		expect(interpolate('Buy ${item} for ${price}', { item: 'pistol', price: 500 })).toBe(
			'Buy pistol for 500',
		)
	})

	it('leaves missing params untouched', () => {
		expect(interpolate('Hello {name}', {})).toBe('Hello {name}')
	})

	it('returns the template unchanged with no params', () => {
		expect(interpolate('plain text')).toBe('plain text')
	})
})

describe('I18nService', () => {
	const en = defineLocale({
		'shop.title': 'Weapon Shop',
		'shop.buy': 'Buy {weapon} for ${price}?',
	})
	const de = defineLocale({
		'shop.title': 'Waffenladen',
		'shop.buy': '{weapon} für {price}€ kaufen?',
	})

	it('resolves keys in the player locale', () => {
		const i = new I18nService({ defaultLocale: 'en' })
		i.registerTranslations('shop', 'en', en)
		i.registerTranslations('shop', 'de', de)
		i.setPlayerLocale(1, 'de')
		expect(i.t(1, 'shop.title')).toBe('Waffenladen')
	})

	it('interpolates parameters', () => {
		const i = new I18nService()
		i.registerTranslations('shop', 'en', en)
		expect(i.t(1, 'shop.buy', { weapon: 'pistol', price: 500 })).toBe(
			'Buy pistol for 500?',
		)
	})

	it('falls back to server default when key missing in player locale', () => {
		const i = new I18nService({ defaultLocale: 'en' })
		i.registerTranslations('shop', 'en', en)
		i.setPlayerLocale(1, 'fr') // unknown locale
		expect(i.t(1, 'shop.title')).toBe('Weapon Shop')
	})

	it('returns the raw key as final fallback', () => {
		const i = new I18nService()
		i.registerTranslations('shop', 'en', en)
		expect(i.t(1, 'shop.unknown')).toBe('shop.unknown')
	})

	it('reports missing keys via onMissing callback', () => {
		const missing: string[] = []
		const i = new I18nService({ onMissing: (key) => missing.push(key) })
		i.registerTranslations('shop', 'en', en)
		i.t(1, 'shop.unknown')
		expect(missing).toContain('shop.unknown')
	})

	it('hasKey returns true only for registered keys', () => {
		const i = new I18nService()
		i.registerTranslations('shop', 'en', en)
		expect(i.hasKey('shop.title', 'en')).toBe(true)
		expect(i.hasKey('shop.title', 'de')).toBe(false)
	})

	it('clearPlayerLocale removes the per-player setting', () => {
		const i = new I18nService({ defaultLocale: 'en' })
		i.setPlayerLocale(1, 'de')
		i.clearPlayerLocale(1)
		expect(i.getPlayerLocale(1)).toBe('en')
	})
})
