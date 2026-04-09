import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Command } from 'commander'
import { generateFullModuleFiles } from '../templates/full-module'
import { cliLog } from '../utils/logger'

/**
 * `nextvm add <module>` — Scaffold a blank or fully-layered module.
 * --blank → minimal one-file scaffold for prototyping
 * --full  → layered module following MODULE_ARCHITECTURE.md
 *           (recommended for any non-trivial module)
 * Registry installation lands with @nextvm/registry in Block K.
 */
export function registerAddCommand(program: Command): void {
	program
		.command('add <name>')
		.description('Add a module from the registry or scaffold a new one')
		.option('--blank', 'Minimal one-file scaffold')
		.option(
			'--full',
			'Layered scaffold following MODULE_ARCHITECTURE.md (recommended)',
		)
		.action(async (name: string, opts: { blank?: boolean; full?: boolean }) => {
			const target = join('modules', name)

			if (existsSync(target)) {
				cliLog.error(`Module '${name}' already exists at ${target}`)
				process.exit(1)
			}

			if (!opts.blank && !opts.full) {
				cliLog.warn(
					'Registry install is not yet available — pass --full or --blank to scaffold locally.',
				)
				cliLog.step(
					'Registry support arrives with @nextvm/registry in .',
				)
				process.exit(2)
			}

			if (opts.full) {
				await scaffoldFull(name, target)
			} else {
				await scaffoldBlank(name, target)
			}
		})
}

async function scaffoldFull(name: string, target: string): Promise<void> {
	cliLog.header(`Scaffolding full layered module: ${name}`)

	const files = generateFullModuleFiles(name)

	await mkdir(join(target, 'src', 'server'), { recursive: true })
	await mkdir(join(target, 'src', 'client'), { recursive: true })
	await mkdir(join(target, 'src', 'shared', 'locales'), { recursive: true })
	await mkdir(join(target, 'src', 'adapters'), { recursive: true })
	await mkdir(join(target, '__tests__'), { recursive: true })

	await writeFile(join(target, 'src', 'index.ts'), files.indexTs)
	await writeFile(join(target, 'src', 'server', 'service.ts'), files.serverServiceTs)
	await writeFile(join(target, 'src', 'server', 'router.ts'), files.serverRouterTs)
	await writeFile(join(target, 'src', 'client', 'index.ts'), files.clientIndexTs)
	await writeFile(join(target, 'src', 'shared', 'schemas.ts'), files.sharedSchemasTs)
	await writeFile(join(target, 'src', 'shared', 'constants.ts'), files.sharedConstantsTs)
	await writeFile(join(target, 'src', 'shared', 'locales', 'en.ts'), files.localeEnTs)
	await writeFile(join(target, 'src', 'shared', 'locales', 'de.ts'), files.localeDeTs)
	await writeFile(join(target, 'src', 'adapters', 'README.md'), files.adapterReadme)
	await writeFile(join(target, '__tests__', 'service.test.ts'), files.serviceTestTs)
	await writeFile(join(target, '__tests__', 'router.test.ts'), files.routerTestTs)
	await writeFile(join(target, 'package.json'), files.packageJson)
	await writeFile(join(target, 'tsconfig.json'), files.tsconfig)
	await writeFile(join(target, 'tsup.config.ts'), files.tsupConfig)
	await writeFile(join(target, 'vitest.config.ts'), files.vitestConfig)

	cliLog.success(`Module '${name}' scaffolded at ${target}`)
	cliLog.step('Layered structure: src/{server,client,shared,adapters}, __tests__')
	cliLog.step('See https://docs.nextvm.dev for the module authoring guide')
	cliLog.step(`Next: pnpm install && pnpm --filter @nextvm/${name} test`)
}

async function scaffoldBlank(name: string, target: string): Promise<void> {
	cliLog.header(`Scaffolding blank module: ${name}`)

	await mkdir(join(target, 'src', 'shared', 'locales'), { recursive: true })
	await mkdir(join(target, '__tests__'), { recursive: true })

	const indexTs = `import { defineModule, z } from '@nextvm/core'

export default defineModule({
	name: '${name}',
	version: '0.1.0',

	config: z.object({
		exampleSetting: z.number().default(100).describe('Example setting'),
	}),

	server: (ctx) => {
		ctx.log.info('${name} server module loaded')
	},

	client: (ctx) => {
		ctx.log.info('${name} client module loaded')
	},
})
`
	await writeFile(join(target, 'src', 'index.ts'), indexTs)

	const enLocale = `import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
	'${name}.title': '${name}',
})
`
	await writeFile(join(target, 'src', 'shared', 'locales', 'en.ts'), enLocale)

	const testFile = `import { describe, it, expect } from 'vitest'
import { createMockContext } from '@nextvm/test-utils'

describe('${name}', () => {
	it('should load with default config', () => {
		const ctx = createMockContext({ name: '${name}', config: { exampleSetting: 100 } })
		expect(ctx.name).toBe('${name}')
	})
})
`
	await writeFile(join(target, '__tests__', `${name}.test.ts`), testFile)

	const pkg = {
		name: `@nextvm/${name}`,
		version: '0.1.0',
		private: true,
		type: 'module',
		peerDependencies: {
			'@nextvm/core': 'workspace:*',
			'@nextvm/i18n': 'workspace:*',
		},
	}
	await writeFile(join(target, 'package.json'), JSON.stringify(pkg, null, 2))

	cliLog.success(`Module '${name}' scaffolded at ${target}`)
	cliLog.step('For a layered structure use --full instead of --blank')
}
