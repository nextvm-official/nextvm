/**
 * Shared constants + helpers used by every template renderer.
 */

export const NEXTVM_VERSION = '^0.0.2'
export const NEXTVM_CLI_VERSION = '^0.0.2'
export const TYPESCRIPT_VERSION = '^5.7.0'
export const ZOD_VERSION = '^3.24.0'
export const VITEST_VERSION = '^2.1.0'
export const NODE_ENGINES = '>=22.0.0 <23.0.0'

export interface PackageJsonShape {
	name: string
	version: string
	private?: boolean
	type?: string
	engines?: Record<string, string>
	scripts?: Record<string, string>
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

export const TSCONFIG = {
	compilerOptions: {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'bundler',
		strict: true,
		esModuleInterop: true,
		skipLibCheck: true,
		resolveJsonModule: true,
		isolatedModules: true,
		noUncheckedIndexedAccess: true,
	},
	include: ['modules', 'nextvm.config.ts'],
}

export const GITIGNORE = `node_modules/
dist/
.next/
.turbo/
.nextvm/
.env
.env.local
*.log
`

/** Stringify a JSON object with two-space indent + trailing newline. */
export function jsonFile(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`
}
