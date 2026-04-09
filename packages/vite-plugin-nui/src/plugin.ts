import {
	buildVirtualModuleSource,
	RESOLVED_VIRTUAL_ID,
	VIRTUAL_ID,
} from './virtual-module'
import { generateFxmanifestSnippet } from './fxmanifest'

/**
 * The shape we accept from `vite` without depending on it at type level.
 *
 * Vite is a peer dep so we keep the surface minimal — anything more
 * specific than this would force consumers to install identical Vite
 * versions everywhere.
 */
export interface VitePluginLike {
	name: string
	enforce?: 'pre' | 'post'
	config?: (config: unknown, env: { command: string; mode: string }) => unknown
	resolveId?: (id: string) => string | null
	load?: (id: string) => string | null
	configureServer?: (server: { httpServer: { once: (e: string, cb: () => void) => void } | null; config: { server: { port: number; host: string | boolean | undefined } } }) => void
	writeBundle?: (options: { dir?: string }, bundle: Record<string, { fileName: string }>) => void | Promise<void>
}

export interface NextvmNuiPluginOptions {
	/**
	 * Resource name embedded into the virtual module. Defaults to the
	 * basename of the project root, which matches what FiveM uses for
	 * `GetCurrentResourceName()` in 95% of setups.
	 */
	resourceName?: string
	/** Where the production NUI bundle should land relative to the resource root. Default `'nui'`. */
	uiDir?: string
	/** Path to write the generated fxmanifest snippet. Default `'<resourceRoot>/fxmanifest.nui.lua'`. */
	fxmanifestSnippetPath?: string
	/** Disable the dev HMR URL print (default: false) */
	silent?: boolean
	/**
	 * Override the side-effecting bits for tests. The plugin uses these
	 * instead of importing `node:fs` / `node:console` directly so the
	 * production code stays unit-testable in plain Node.
	 */
	io?: {
		writeFile: (path: string, contents: string) => void
		log: (msg: string) => void
		basename: (path: string) => string
	}
}

const defaultIo = (): NonNullable<NextvmNuiPluginOptions['io']> => {
	return {
		writeFile: (path, contents) => {
			// Lazy require to keep tsup happy without `node:fs` in the bundle deps.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const fs = require('node:fs') as typeof import('node:fs')
			fs.writeFileSync(path, contents)
		},
		log: (msg) => {
			// eslint-disable-next-line no-console
			console.log(msg)
		},
		basename: (p) => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const path = require('node:path') as typeof import('node:path')
			return path.basename(p)
		},
	}
}

/**
 * The NextVM Vite plugin.
 *
 * Use it in your NUI app's `vite.config.ts`:
 *
 *   import { defineConfig } from 'vite'
 *   import react from '@vitejs/plugin-react'
 *   import { nextvmNui } from '@nextvm/vite-plugin-nui'
 *
 *   export default defineConfig({
 *     plugins: [react(), nextvmNui({ resourceName: 'my-server' })],
 *   })
 *
 * The plugin:
 *   1. Forces FiveM-friendly Vite settings (`base: './'`, no source
 *      maps in production, no preload polyfills, no externals)
 *   2. Resolves `virtual:nextvm-nui` to a tiny ES module exposing the
 *      resource name + the NuiBrowser constructor
 *   3. In dev, prints the localhost URL to set as `ui_page`
 *   4. In production, writes `fxmanifest.nui.lua` next to the resource
 *      root listing `ui_page` + `files`
 */
export function nextvmNui(options: NextvmNuiPluginOptions = {}): VitePluginLike {
	const io = options.io ?? defaultIo()
	let isDev = false
	let resourceNameResolved = options.resourceName ?? ''

	return {
		name: '@nextvm/vite-plugin-nui',
		enforce: 'pre',
		config(config, env) {
			isDev = env.command === 'serve'
			// Default the resource name from the cwd basename if not given.
			if (!resourceNameResolved) {
				resourceNameResolved = io.basename(process.cwd())
			}
			return {
				...(config as Record<string, unknown>),
				base: './',
				build: {
					...(((config as Record<string, unknown>).build as Record<string, unknown>) ??
						{}),
					sourcemap: false,
					assetsInlineLimit: 0,
					modulePreload: { polyfill: false },
				},
			}
		},
		resolveId(id) {
			if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
			return null
		},
		load(id) {
			if (id !== RESOLVED_VIRTUAL_ID) return null
			return buildVirtualModuleSource({
				resourceName: resourceNameResolved,
				devMode: isDev,
			})
		},
		configureServer(server) {
			if (options.silent) return
			const port = server.config.server.port ?? 5173
			const host =
				typeof server.config.server.host === 'string'
					? server.config.server.host
					: 'localhost'
			io.log(
				`\n[nextvm-nui] Dev server ready. Set this as your fxmanifest ui_page in dev:\n  ui_page 'http://${host}:${port}/'\n`,
			)
		},
		writeBundle(_outOpts, bundle) {
			const files = Object.keys(bundle)
			const snippet = generateFxmanifestSnippet({
				uiDir: options.uiDir,
				files,
			})
			const target = options.fxmanifestSnippetPath ?? 'fxmanifest.nui.lua'
			io.writeFile(target, snippet)
			if (!options.silent) {
				io.log(`[nextvm-nui] Wrote ${target} (${files.length} files)`)
			}
		},
	}
}
