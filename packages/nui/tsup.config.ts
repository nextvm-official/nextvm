import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts', 'src/client.ts', 'src/browser.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
})
