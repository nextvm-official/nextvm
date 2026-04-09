import { describe, expect, it } from 'vitest'
import { generateFxmanifestSnippet } from '../fxmanifest'
import { nextvmNui } from '../plugin'
import {
	buildVirtualModuleSource,
	RESOLVED_VIRTUAL_ID,
	VIRTUAL_ID,
} from '../virtual-module'

const buildPlugin = (overrides: Parameters<typeof nextvmNui>[0] = {}) => {
	const writes: Array<[string, string]> = []
	const logs: string[] = []
	const plugin = nextvmNui({
		resourceName: 'my-server',
		silent: false,
		io: {
			writeFile: (p, c) => writes.push([p, c]),
			log: (m) => logs.push(m),
			basename: (p) => p.split(/[\\/]/).pop() ?? '',
		},
		...overrides,
	})
	return { plugin, writes, logs }
}

describe('generateFxmanifestSnippet', () => {
	it('emits ui_page + files block', () => {
		const out = generateFxmanifestSnippet({
			files: ['index.html', 'assets/index-abc.js', 'assets/style.css'],
		})
		expect(out).toContain("ui_page 'nui/index.html'")
		expect(out).toContain("'nui/index.html'")
		expect(out).toContain("'nui/assets/index-abc.js'")
		expect(out).toContain("'nui/assets/style.css'")
	})

	it('respects custom uiDir', () => {
		const out = generateFxmanifestSnippet({
			uiDir: 'web',
			files: ['index.html'],
		})
		expect(out).toContain("ui_page 'web/index.html'")
		expect(out).toContain("'web/index.html'")
	})

	it('throws when index.html is missing', () => {
		expect(() => generateFxmanifestSnippet({ files: ['x.js'] })).toThrow(/index\.html/)
	})
})

describe('buildVirtualModuleSource', () => {
	it('embeds the resource name and dev flag', () => {
		const src = buildVirtualModuleSource({ resourceName: 'foo', devMode: true })
		expect(src).toContain(`export const resourceName = "foo"`)
		expect(src).toContain(`export const devMode = true`)
		expect(src).toContain(`export { NuiBrowser } from '@nextvm/nui/browser'`)
	})
})

describe('nextvmNui plugin', () => {
	it('has the right name + enforce', () => {
		const { plugin } = buildPlugin()
		expect(plugin.name).toBe('@nextvm/vite-plugin-nui')
		expect(plugin.enforce).toBe('pre')
	})

	it('config() forces FiveM-friendly settings', () => {
		const { plugin } = buildPlugin()
		const result = plugin.config?.({}, { command: 'build', mode: 'production' }) as Record<
			string,
			unknown
		>
		expect(result.base).toBe('./')
		const build = result.build as Record<string, unknown>
		expect(build.sourcemap).toBe(false)
		expect(build.assetsInlineLimit).toBe(0)
	})

	it('config() detects dev mode', () => {
		const { plugin } = buildPlugin()
		plugin.config?.({}, { command: 'serve', mode: 'development' })
		const src = plugin.load?.(RESOLVED_VIRTUAL_ID) as string
		expect(src).toContain(`devMode = true`)
	})

	it('config() detects production mode', () => {
		const { plugin } = buildPlugin()
		plugin.config?.({}, { command: 'build', mode: 'production' })
		const src = plugin.load?.(RESOLVED_VIRTUAL_ID) as string
		expect(src).toContain(`devMode = false`)
	})

	it('resolveId only matches the virtual id', () => {
		const { plugin } = buildPlugin()
		expect(plugin.resolveId?.(VIRTUAL_ID)).toBe(RESOLVED_VIRTUAL_ID)
		expect(plugin.resolveId?.('react')).toBeNull()
	})

	it('load returns the virtual module source for the resolved id', () => {
		const { plugin } = buildPlugin()
		plugin.config?.({}, { command: 'build', mode: 'production' })
		const src = plugin.load?.(RESOLVED_VIRTUAL_ID) as string
		expect(src).toContain(`export const resourceName = "my-server"`)
		expect(plugin.load?.('virtual:something-else')).toBeNull()
	})

	it('falls back to the cwd basename when resourceName is omitted', () => {
		const { plugin } = buildPlugin({ resourceName: undefined })
		plugin.config?.({}, { command: 'build', mode: 'production' })
		const src = plugin.load?.(RESOLVED_VIRTUAL_ID) as string
		// cwd basename will be the package folder name during the test
		expect(src).toMatch(/export const resourceName = "[^"]+"/)
	})

	it('writeBundle emits a fxmanifest snippet listing every file', () => {
		const { plugin, writes } = buildPlugin()
		plugin.writeBundle?.(
			{ dir: 'dist' },
			{
				'index.html': { fileName: 'index.html' },
				'assets/main.js': { fileName: 'assets/main.js' },
			},
		)
		expect(writes).toHaveLength(1)
		expect(writes[0][0]).toBe('fxmanifest.nui.lua')
		expect(writes[0][1]).toContain("'nui/index.html'")
		expect(writes[0][1]).toContain("'nui/assets/main.js'")
	})

	it('writeBundle respects fxmanifestSnippetPath + uiDir overrides', () => {
		const { plugin, writes } = buildPlugin({
			fxmanifestSnippetPath: 'out/manifest.lua',
			uiDir: 'web',
		})
		plugin.writeBundle?.(
			{ dir: 'dist' },
			{ 'index.html': { fileName: 'index.html' } },
		)
		expect(writes[0][0]).toBe('out/manifest.lua')
		expect(writes[0][1]).toContain("ui_page 'web/index.html'")
	})

	it('configureServer prints the dev URL', () => {
		const { plugin, logs } = buildPlugin()
		plugin.configureServer?.({
			httpServer: null,
			config: { server: { port: 3000, host: 'localhost' } },
		})
		expect(logs.some((l) => l.includes('http://localhost:3000'))).toBe(true)
	})

	it('configureServer is silent when silent: true', () => {
		const { plugin, logs } = buildPlugin({ silent: true })
		plugin.configureServer?.({
			httpServer: null,
			config: { server: { port: 5173, host: undefined } },
		})
		expect(logs).toEqual([])
	})
})
