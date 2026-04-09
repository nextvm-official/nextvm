import { describe, expect, it } from 'vitest'
import { generateFxmanifest } from '../src'
import type { ResolvedModule } from '../src'

const mod: ResolvedModule = {
	name: '@nextvm/banking',
	version: '1.2.3',
	path: '/tmp/banking',
	relativePath: 'modules/banking',
	packageJson: { description: 'Banking module' },
}

describe('generateFxmanifest', () => {
	it('emits the cerulean header with version + description', () => {
		const manifest = generateFxmanifest(mod)
		expect(manifest).toContain("fx_version 'cerulean'")
		expect(manifest).toContain("games { 'gta5' }")
		expect(manifest).toContain("version '1.2.3'")
		expect(manifest).toContain("description 'Banking module'")
	})

	it('references both server and client by default', () => {
		const manifest = generateFxmanifest(mod)
		expect(manifest).toContain("server_script 'dist/server.js'")
		expect(manifest).toContain("client_script 'dist/client.js'")
	})

	it('omits client script when hasClient: false', () => {
		const manifest = generateFxmanifest(mod, { hasClient: false })
		expect(manifest).not.toContain("client_script")
	})

	it('emits dependencies block when supplied', () => {
		const manifest = generateFxmanifest(mod, { dependencies: ['nextvm-core', 'nextvm-player'] })
		expect(manifest).toContain('dependencies {')
		expect(manifest).toContain("'nextvm-core'")
		expect(manifest).toContain("'nextvm-player'")
	})

	it('escapes single quotes in description', () => {
		const apostrophe: ResolvedModule = {
			...mod,
			packageJson: { description: "Doesn't crash" },
		}
		const manifest = generateFxmanifest(apostrophe)
		expect(manifest).toContain("Doesn\\'t crash")
	})

	it('emits lua54 marker when requested', () => {
		const manifest = generateFxmanifest(mod, { requireLua54: true })
		expect(manifest).toContain("lua54 'yes'")
	})
})
