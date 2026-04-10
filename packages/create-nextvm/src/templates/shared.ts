/**
 * Shared constants + helpers used by every template renderer.
 */

export const NEXTVM_VERSION = '^0.0.1'
export const NEXTVM_CLI_VERSION = '^0.1.0'
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
.fxserver/
.env
.env.local
*.log
`

export const ENV_EXAMPLE = `# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=nextvm

# FXServer (optional — enables \`nextvm dev --serve\` and \`nextvm serve\`)
# Absolute path to a downloaded FXServer artifact directory containing
# FXServer.exe (Windows) or run.sh / FXServer (Linux).
# Download: https://runtime.fivem.net/artifacts/fivem/
FXSERVER_PATH=

# Absolute path to the data directory containing resources/.
# This is the cfx-server-data clone. Leave empty if your binary and
# resources live in the same folder (all-in-one layout).
FXSERVER_DATA_PATH=

# Cfx.re license key — get yours at https://keymaster.fivem.net
CFX_LICENSE_KEY=
`

/** Stringify a JSON object with two-space indent + trailing newline. */
export function jsonFile(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`
}
