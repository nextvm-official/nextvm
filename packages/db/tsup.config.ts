import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	// Keep mysql2 + workspace deps out of the bundle so consumers install them
	// as runtime deps (avoids duplicate connection pools, smaller bundle).
	external: ['mysql2', 'mysql2/promise', '@nextvm/core'],
})
