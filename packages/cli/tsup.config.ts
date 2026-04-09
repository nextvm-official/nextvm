import { defineConfig } from 'tsup'

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		bin: 'src/bin.ts',
	},
	format: ['esm'],
	dts: { entry: 'src/index.ts' },
	clean: true,
	sourcemap: true,
	// Externals: keep node_modules out of the bundle so the published
	// CLI installs them as runtime dependencies (smaller bundle, faster
	// install, no double-version risk).
	external: [
		'commander',
		'picocolors',
		'@nextvm/core',
		'@nextvm/db',
		'@nextvm/build',
		'@nextvm/registry',
		'@nextvm/migration',
	],
	// Note: shebang lives directly in src/bin.ts, no banner needed
})
