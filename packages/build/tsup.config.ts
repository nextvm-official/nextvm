import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	external: ['@nextvm/core', 'jiti', 'tsup', 'chokidar', 'picocolors', 'zod'],
})
