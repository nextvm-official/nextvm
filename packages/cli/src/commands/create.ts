import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm create <name>` — Scaffold a new NextVM server project.
 */
export function registerCreateCommand(program: Command): void {
	program
		.command('create <name>')
		.description('Scaffold a new NextVM server project')
		.option('--dir <path>', 'Target directory (defaults to <name>)')
		.action(async (name: string, opts: { dir?: string }) => {
			const target = opts.dir ?? name
			cliLog.header(`Creating NextVM project: ${name}`)

			if (existsSync(target)) {
				cliLog.error(`Directory '${target}' already exists.`)
				process.exit(1)
			}

			await mkdir(target, { recursive: true })
			await mkdir(join(target, 'modules'), { recursive: true })
			await mkdir(join(target, 'config'), { recursive: true })

			const pkg = {
				name,
				version: '0.1.0',
				private: true,
				type: 'module',
				engines: { node: '>=22.0.0 <23.0.0' },
				scripts: {
					dev: 'nextvm dev',
					build: 'nextvm build',
					validate: 'nextvm validate',
					'add:module': 'nextvm add',
				},
				dependencies: {
					'@nextvm/core': '^0.0.2',
					'@nextvm/db': '^0.0.2',
					'@nextvm/i18n': '^0.0.2',
					'@nextvm/natives': '^0.0.2',
					'@nextvm/runtime-client': '^0.0.2',
					'@nextvm/runtime-server': '^0.0.2',
					zod: '^3.24.0',
				},
				devDependencies: {
					'@nextvm/cli': '^0.0.2',
					typescript: '^5.7.0',
				},
			}
			await writeFile(join(target, 'package.json'), JSON.stringify(pkg, null, 2))

			const tsconfig = {
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'bundler',
					strict: true,
					esModuleInterop: true,
					skipLibCheck: true,
				},
				include: ['modules', 'config'],
			}
			await writeFile(join(target, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

			const nextvmConfig = `import { z } from '@nextvm/core'

/**
 * NextVM server configuration.
 * Validated at startup against this schema.
 */
export default {
	server: {
		name: '${name}',
		maxPlayers: 32,
		defaultLocale: 'en',
	},
	database: {
		host: 'localhost',
		port: 3306,
		user: 'root',
		password: '',
		database: 'nextvm',
	},
	modules: [
		// Add module imports here
	],
}
`
			await writeFile(join(target, 'nextvm.config.ts'), nextvmConfig)

			const gitignore = `node_modules/
dist/
.env
.env.local
*.log
.turbo/
`
			await writeFile(join(target, '.gitignore'), gitignore)

			cliLog.success(`Created project '${name}' in ${target}`)
			cliLog.step(`cd ${target}`)
			cliLog.step('pnpm install')
			cliLog.step('nextvm dev')
		})
}
