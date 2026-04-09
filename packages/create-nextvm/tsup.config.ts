import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: false,
	clean: true,
	sourcemap: false,
	minify: false,
	target: 'node22',
	banner: { js: '#!/usr/bin/env node' },
})
