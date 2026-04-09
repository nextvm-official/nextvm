import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nextvmNui } from '@nextvm/vite-plugin-nui'

/**
 * NUI Vite config for the Full Stack Example.
 *
 * `@nextvm/vite-plugin-nui` forces the FiveM-friendly defaults
 * (base: './', no sourcemap, no inlined assets, no modulePreload
 * polyfill), exposes the `virtual:nextvm-nui` module so React code
 * never hardcodes the resource name, and writes a `fxmanifest.nui.lua`
 * snippet next to the project root on `vite build`.
 */
export default defineConfig({
	plugins: [
		react(),
		nextvmNui({
			resourceName: 'nextvm-core',
			uiDir: 'nui',
		}),
	],
})
