import type { FileEntry } from '../index'
import {
	GITIGNORE,
	jsonFile,
	NEXTVM_CLI_VERSION,
	NEXTVM_VERSION,
	NODE_ENGINES,
	type PackageJsonShape,
	TSCONFIG,
	TYPESCRIPT_VERSION,
	ZOD_VERSION,
} from './shared'

/**
 * Blank template — empty project, no modules, no bootstrap.
 *
 * Useful for advanced users who want full control over the layout
 * from day one.
 */
export function renderBlankTemplate(name: string): FileEntry[] {
	const pkg: PackageJsonShape = {
		name,
		version: '0.1.0',
		private: true,
		type: 'module',
		engines: { node: NODE_ENGINES },
		scripts: {
			dev: 'nextvm dev',
			build: 'nextvm build',
			validate: 'nextvm validate',
			'add:module': 'nextvm add',
		},
		dependencies: {
			'@nextvm/core': NEXTVM_VERSION,
			'@nextvm/db': NEXTVM_VERSION,
			'@nextvm/i18n': NEXTVM_VERSION,
			'@nextvm/natives': NEXTVM_VERSION,
			'@nextvm/runtime-client': NEXTVM_VERSION,
			'@nextvm/runtime-server': NEXTVM_VERSION,
			zod: ZOD_VERSION,
		},
		devDependencies: {
			'@nextvm/cli': NEXTVM_CLI_VERSION,
			typescript: TYPESCRIPT_VERSION,
		},
	}

	const nextvmConfig = `/**
 * NextVM project configuration.
 * Loaded by the CLI for build / dev / validate / migrate commands.
 */
export default {
	server: {
		name: ${JSON.stringify(name)},
		maxPlayers: 32,
		defaultLocale: 'en',
	},
	database: {
		host: process.env.MYSQL_HOST ?? 'localhost',
		port: 3306,
		user: process.env.MYSQL_USER ?? 'root',
		password: process.env.MYSQL_PASSWORD ?? '',
		database: process.env.MYSQL_DB ?? 'nextvm',
	},
	modules: [],
}
`

	const readme = `# ${name}

A NextVM server project.

## Getting started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Add your first module

\`\`\`bash
pnpm add:module shop --full
\`\`\`

## Documentation

- [NextVM Docs](https://docs.nextvm.dev)
- [Getting Started Guide](https://docs.nextvm.dev/guide/end-to-end)
`

	return [
		{ path: 'package.json', contents: jsonFile(pkg) },
		{ path: 'tsconfig.json', contents: jsonFile(TSCONFIG) },
		{ path: 'nextvm.config.ts', contents: nextvmConfig },
		{ path: '.gitignore', contents: GITIGNORE },
		{ path: 'README.md', contents: readme },
	]
}
