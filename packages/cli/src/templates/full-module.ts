/**
 * Full-layered module scaffold templates.
 * Generates the same structure as the @nextvm/banking reference module.
 * Files use the supplied module name to keep imports + identifiers
 * consistent.
 */

const pascal = (name: string): string =>
	name
		.split(/[-_/]/)
		.filter(Boolean)
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join('')

export interface FullModuleFiles {
	indexTs: string
	serverServiceTs: string
	serverRouterTs: string
	clientIndexTs: string
	sharedSchemasTs: string
	sharedConstantsTs: string
	localeEnTs: string
	localeDeTs: string
	adapterReadme: string
	serviceTestTs: string
	routerTestTs: string
	packageJson: string
	tsconfig: string
	tsupConfig: string
	vitestConfig: string
}

export function generateFullModuleFiles(name: string): FullModuleFiles {
	const Pascal = pascal(name)

	const indexTs = `import { defineExports, defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import { build${Pascal}Router } from './server/router'
import { ${Pascal}Service } from './server/service'

/**
 * @nextvm/${name} — TODO: describe what this module owns.
 */

/** Public service surface — consumed via inject<${Pascal}Exports>('${name}') */
export type ${Pascal}Exports = ReturnType<typeof build${Pascal}Exports>

function build${Pascal}Exports(service: ${Pascal}Service) {
	return defineExports({
		service,
		// TODO: expose typed methods other modules can call
	})
}

export default defineModule({
	name: '${name}',
	version: '0.1.0',
	dependencies: [],

	config: z.object({
		exampleSetting: z
			.number()
			.int()
			.min(0)
			.default(100)
			.describe('Example numeric setting (replace with real config)'),
	}),

	server: (ctx) => {
		const config = ctx.config as { exampleSetting: number }
		const service = new ${Pascal}Service()
		const router = build${Pascal}Router(service)

		ctx.log.info('${name} module loaded (server)', {
			procedures: Object.keys(router).length,
			exampleSetting: config.exampleSetting,
		})

		// Publish the public surface so other modules can inject() us
		ctx.setExports(build${Pascal}Exports(service))

		ctx.onPlayerReady(async (_player) => {
			// TODO: initialize per-character state
		})

		ctx.onPlayerDropped(async (_player) => {
			// TODO: clean up per-character state
		})
	},

	client: (ctx) => {
		ctx.log.info('${name} module loaded (client)')
	},

	shared: {
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

export { ${Pascal}Service } from './server/service'
export { build${Pascal}Router } from './server/router'
`

	const serverServiceTs = `/**
 * ${Pascal}Service — domain logic for the ${name} module.
 * Tests: __tests__/service.test.ts exercises this directly without an
 * RpcRouter — the service is pure TS so service-level tests are fast
 * and stable.
 */
export class ${Pascal}Service {
	private state = new Map<number, { /* TODO: per-character fields */ }>()

	get(charId: number) {
		return this.state.get(charId)
	}

	set(charId: number, value: object): void {
		this.state.set(charId, value)
	}

	clear(charId: number): void {
		this.state.delete(charId)
	}
}
`

	const serverRouterTs = `import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { ${Pascal}Service } from './service'

/**
 * Build the ${name} RPC router with the service captured in the closure.
 * The router is a thin boundary — business logic lives in the service.
 */
export function build${Pascal}Router(service: ${Pascal}Service) {
	return defineRouter({
		getMine: procedure.query(({ ctx }) => {
			if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
			return service.get(ctx.charId)
		}),

		// TODO: add more procedures here. Each one:
		//   .input(z.object({ ... }))
		//   .auth?((ctx) => permissions.hasPermission(ctx.source, '...'))
		//   .query / .mutation(handler)
	})
}
`

	const clientIndexTs = `/**
 * Client-side entry for the ${name} module.
 * Runs in the FiveM V8 client runtime. Use ctx.onMounted() for code
 * that needs the local player to be spawned, ctx.onTick() for managed
 * frame loops, and ctx.events.on() to react to other modules.
 */

// Empty by default — populated when the module needs client-side hooks.
export {}
`

	const sharedSchemasTs = `import { z } from 'zod'

/**
 * Shared Zod schemas for the ${name} module.
 * runtime validation, TypeScript types, dashboard widgets, and i18n key
 * enforcement. Define them here and import from server/router.ts.
 */

export const exampleInputSchema = z.object({
	id: z.number().int().positive(),
})

export type ExampleInput = z.infer<typeof exampleInputSchema>
`

	const sharedConstantsTs = `/**
 * Shared constants for the ${name} module.
 * Event names, ACE permission strings, default values that need to be
 * referenced from both server and client live here. Keeping them as
 * exported constants makes refactoring safe (one rename, all callers
 * updated) and avoids magic strings scattered through the codebase.
 */

export const EVENTS = {
	// e.g. SOMETHING_HAPPENED: '${name}:somethingHappened',
} as const

export const PERMISSIONS = {
	// e.g. ADMIN: '${name}.admin',
} as const
`

	const localeEnTs = `import { defineLocale } from '@nextvm/i18n'

export default defineLocale
})
`

	const localeDeTs = `import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
	'${name}.title': '${name}',
	// TODO: deutsche Übersetzungen — jeder Schlüssel aus en.ts muss hier auch existieren
})
`

	const adapterReadme = `# Adapters

Drop typed interfaces here for every module this module **consumes** at
runtime via \`ctx.inject<T>('other-module')\`.

Defining the contract here (instead of importing the producer module
directly) is the  escape hatch: the consumer owns the shape it
needs, the producer does not have to know who calls it, and tests can
trivially substitute a stub.

Example for a module that needs banking.addMoney:

\`\`\`typescript
// adapters/banking-adapter.ts
export interface BankingAdapter {
  addMoney(
    charId: number,
    type: 'cash' | 'bank',
    amount: number,
    reason?: string,
  ): Promise<number>
}
\`\`\`

Then in src/index.ts:

\`\`\`typescript
import type { BankingAdapter } from './adapters/banking-adapter'

server: (ctx) => {
  const banking = ctx.inject<BankingAdapter>('banking')
  // ... pass banking into your service
}
\`\`\`
`

	const serviceTestTs = `import { describe, expect, it } from 'vitest'
import { ${Pascal}Service } from '../src/server/service'

describe('${Pascal}Service', () => {
	it('starts empty for an unknown character', () => {
		const svc = new ${Pascal}Service()
		expect(svc.get(1)).toBeUndefined()
	})

	it('persists writes per character', () => {
		const svc = new ${Pascal}Service()
		svc.set(1, { hello: 'world' })
		expect(svc.get(1)).toEqual({ hello: 'world' })
	})

	it('clear() removes a character entry', () => {
		const svc = new ${Pascal}Service()
		svc.set(1, {})
		svc.clear(1)
		expect(svc.get(1)).toBeUndefined()
	})
})
`

	const routerTestTs = `import { createModuleHarness } from '@nextvm/test-utils'
import { describe, expect, it } from 'vitest'
import { build${Pascal}Router, ${Pascal}Service } from '../src'

const buildHarness = () => {
	const svc = new ${Pascal}Service()
	const harness = createModuleHarness({
		namespace: '${name}',
		router: build${Pascal}Router(svc),
	})
	return { svc, harness }
}

describe('${name} router', () => {
	it('getMine returns nothing for a fresh character', async () => {
		const { harness } = buildHarness()
		const result = await harness.dispatch(1, 'getMine')
		expect(result).toBeUndefined()
	})

	it('getMine returns persisted state', async () => {
		const { svc, harness } = buildHarness()
		svc.set(1, { hello: 'world' })
		const result = await harness.dispatch(1, 'getMine')
		expect(result).toEqual({ hello: 'world' })
	})
})
`

	const packageJson = JSON.stringify(
		{
			name: `@nextvm/${name}`,
			version: '0.1.0',
			private: true,
			type: 'module',
			main: 'dist/index.js',
			types: 'dist/index.d.ts',
			exports: {
				'.': {
					import: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			scripts: {
				build: 'tsup',
				dev: 'tsup --watch',
				typecheck: 'tsc --noEmit',
				test: 'vitest run',
				clean: 'rm -rf dist',
			},
			peerDependencies: {
				'@nextvm/core': 'workspace:*',
				'@nextvm/i18n': 'workspace:*',
			},
			devDependencies: {
				'@nextvm/core': 'workspace:*',
				'@nextvm/i18n': 'workspace:*',
				'@nextvm/test-utils': 'workspace:*',
				tsup: '^8.4.0',
				typescript: '^5.7.0',
				vitest: '^3.0.0',
			},
		},
		null,
		2,
	)

	const tsconfig = JSON.stringify(
		{
			extends: '../../tsconfig.base.json',
			compilerOptions: {
				outDir: 'dist',
				rootDir: 'src',
			},
			include: ['src'],
		},
		null,
		2,
	)

	const tsupConfig = `import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	external: ['@nextvm/core', '@nextvm/i18n'],
})
`

	const vitestConfig = `import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['__tests__/**/*.test.ts'],
	},
})
`

	return {
		indexTs,
		serverServiceTs,
		serverRouterTs,
		clientIndexTs,
		sharedSchemasTs,
		sharedConstantsTs,
		localeEnTs,
		localeDeTs,
		adapterReadme,
		serviceTestTs,
		routerTestTs,
		packageJson,
		tsconfig,
		tsupConfig,
		vitestConfig,
	}
}
