import type { FileEntry } from '../index'
import {
	ENV_EXAMPLE,
	GITIGNORE,
	jsonFile,
	NEXTVM_CLI_VERSION,
	NEXTVM_VERSION,
	NODE_ENGINES,
	type PackageJsonShape,
	TSCONFIG,
	TYPESCRIPT_VERSION,
	VITEST_VERSION,
	ZOD_VERSION,
} from './shared'

/**
 * Starter template — working server with bootstrap + example shop module.
 *
 * After `pnpm install && pnpm build`, the project produces ready-to-
 * `ensure` FiveM resources for:
 *   - banking, jobs, housing, inventory, player, vehicle (first-party)
 *   - shop (example custom module with router + service + tests)
 *   - core (bootstrap module wiring everything together)
 */
export function renderStarterTemplate(name: string): FileEntry[] {
	const rootPkg: PackageJsonShape = {
		name,
		version: '0.1.0',
		private: true,
		type: 'module',
		engines: { node: NODE_ENGINES },
		scripts: {
			dev: 'nextvm dev',
			build: 'nextvm build',
			validate: 'nextvm validate',
			test: 'vitest run',
			'add:module': 'nextvm add',
		},
		dependencies: {
			'@nextvm/banking': NEXTVM_VERSION,
			'@nextvm/core': NEXTVM_VERSION,
			'@nextvm/db': NEXTVM_VERSION,
			'@nextvm/housing': NEXTVM_VERSION,
			'@nextvm/i18n': NEXTVM_VERSION,
			'@nextvm/inventory': NEXTVM_VERSION,
			'@nextvm/jobs': NEXTVM_VERSION,
			'@nextvm/natives': NEXTVM_VERSION,
			'@nextvm/player': NEXTVM_VERSION,
			'@nextvm/runtime-client': NEXTVM_VERSION,
			'@nextvm/runtime-server': NEXTVM_VERSION,
			'@nextvm/vehicle': NEXTVM_VERSION,
			zod: ZOD_VERSION,
		},
		devDependencies: {
			'@nextvm/cli': NEXTVM_CLI_VERSION,
			'@nextvm/test-utils': NEXTVM_VERSION,
			typescript: TYPESCRIPT_VERSION,
			vitest: VITEST_VERSION,
		},
	}

	const nextvmConfig = `/**
 * NextVM project configuration.
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
	modules: [
		'@nextvm/banking',
		'@nextvm/jobs',
		'@nextvm/housing',
		'@nextvm/inventory',
		'@nextvm/player',
		'@nextvm/vehicle',
		'shop',
		'core',
	],
	// Optional: spawn a local FXServer subprocess via \`nextvm dev --serve\`
	// or \`nextvm serve\`. Set FXSERVER_PATH in .env to enable.
	fxserver: process.env.FXSERVER_PATH
		? {
				path: process.env.FXSERVER_PATH,
				licenseKey: process.env.CFX_LICENSE_KEY,
				endpoint: '0.0.0.0:30120',
				gameBuild: 3095,
				additionalResources: [],
				convars: {},
			}
		: undefined,
}
`

	const readme = `# ${name}

A working NextVM server scaffolded from the \`starter\` template.

## What's inside

- \`modules/core\` — Bootstrap module that wires \`bootstrapServer\` /
  \`bootstrapClient\` and registers every other module
- \`modules/shop\` — Example custom module with a layered structure
  (router + service + tests). Use it as a reference for your own modules.
- All first-party game modules pulled in as dependencies:
  banking, jobs, housing, inventory, player, vehicle

## Getting started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Build for production

\`\`\`bash
pnpm build
\`\`\`

This produces \`dist/\` + \`fxmanifest.lua\` for every module under
\`modules/*\`. Copy each module folder into your FXServer's
\`resources/\` directory and \`ensure\` them in \`server.cfg\` (with
\`core\` last so all dependencies are loaded first).

## Running the example RPC call

After \`pnpm dev\` is up and you've connected to your FXServer with the
modules ensured, open the FiveM client console and type:

\`\`\`
shop_list
\`\`\`

That hits the \`shop.listOffers\` RPC procedure on the server and
prints the result.

## Useful commands

| Command | Description |
|---|---|
| \`pnpm dev\` | Watch + rebuild on file changes |
| \`pnpm build\` | Build all modules for production |
| \`pnpm validate\` | Static checks across all modules |
| \`pnpm test\` | Run all module unit tests via vitest |
| \`pnpm add:module <name> --full\` | Scaffold a new layered module |

## Documentation

- [NextVM Docs](https://docs.nextvm.dev)
- [End-to-End Guide](https://docs.nextvm.dev/guide/end-to-end)
`

	// --- modules/core (bootstrap) ---

	const coreIndex = `import { defineModule } from '@nextvm/core'

/**
 * core — bootstrap module.
 *
 * Has no game logic. Exists purely to call \`bootstrapServer\` on the
 * server side and \`bootstrapClient\` on the client side. Listed last
 * in nextvm.config.ts so all other modules are registered first.
 */
export default defineModule({
	name: 'core',
	version: '0.1.0',
	dependencies: [
		'banking',
		'jobs',
		'housing',
		'inventory',
		'player',
		'vehicle',
		'shop',
	],

	server: async (ctx) => {
		ctx.log.info('${name} — bootstrap starting')
		await import('./server')
	},

	client: async (ctx) => {
		ctx.log.info('${name} — client bootstrap starting')
		await import('./client')
	},
})
`

	const coreServer = `import banking from '@nextvm/banking'
import housing from '@nextvm/housing'
import inventory from '@nextvm/inventory'
import jobs from '@nextvm/jobs'
import player from '@nextvm/player'
import vehicle from '@nextvm/vehicle'
import { bootstrapServer } from '@nextvm/runtime-server'
import core from '.'
import shop from '../../shop/src'

/**
 * Server bootstrap. Wires every module into the runtime, attaches the
 * FiveM event bridge, and starts the managed tick loop.
 *
 * In production, pass a real \`characterRepository\` from \`@nextvm/db\`
 * via \`new DbCharacterRepository(new Database(new MySqlAdapter({ ... })))\`.
 * Without it, the runtime falls back to an in-memory repository — fine
 * for development and quick smoke tests.
 */
await bootstrapServer({
	modules: [banking, jobs, housing, inventory, player, vehicle, shop, core],
	stateSnapshot: {},
	devBridge: process.env.NEXTVM_DEV === '1',
})

export {}
`

	const coreClient = `import banking from '@nextvm/banking'
import housing from '@nextvm/housing'
import inventory from '@nextvm/inventory'
import jobs from '@nextvm/jobs'
import player from '@nextvm/player'
import vehicle from '@nextvm/vehicle'
import { bootstrapClient } from '@nextvm/runtime-client'
import { createClient } from '@nextvm/core'
import core from '.'
import shop from '../../shop/src'
import type { buildShopRouter } from '../../shop/src/server/router'

/**
 * Client bootstrap. Mirror of the server bootstrap with one extra
 * step: it builds typed RPC client proxies and exposes them on a
 * window global so other client scripts can call \`window.nextvm.rpc.shop.listOffers()\`.
 */
const runtime = await bootstrapClient({
	modules: [banking, jobs, housing, inventory, player, vehicle, shop, core],
})

const rpc = {
	shop: createClient<ReturnType<typeof buildShopRouter>>('shop', runtime.transport.call),
}

;(globalThis as { nextvm?: unknown }).nextvm = { rpc, runtime }

// Example: \`shop_list\` console command lists offers
RegisterCommand(
	'shop_list',
	async () => {
		try {
			const offers = await rpc.shop.listOffers()
			console.log('[shop] offers:', offers)
		} catch (err) {
			console.error('[shop] failed:', err)
		}
	},
	false,
)

declare function RegisterCommand(
	name: string,
	handler: (...args: unknown[]) => void,
	restricted: boolean,
): void

export {}
`

	const corePkg = {
		name: '@example/core',
		version: '0.1.0',
		private: true,
		type: 'module',
	}

	// --- modules/shop (example) ---

	const shopIndex = `import { defineModule, z } from '@nextvm/core'
import { buildShopRouter } from './server/router'
import { ShopService } from './server/service'

/**
 * shop — example NextVM module.
 *
 * Sells in-game items for in-game cash. Demonstrates:
 *   - Service / Router separation
 *   - Zod-validated RPC procedures
 *   - Cross-module DI (uses @nextvm/banking via the BankingAdapter)
 *   - Per-character state via ctx.charId
 *
 * Replace the hardcoded offers with whatever your server needs.
 */
export default defineModule({
	name: 'shop',
	version: '0.1.0',
	dependencies: ['banking'],

	config: z.object({
		startingOffers: z
			.array(
				z.object({
					id: z.string(),
					name: z.string(),
					priceCash: z.number().int().positive(),
				}),
			)
			.default([
				{ id: 'water', name: 'Water Bottle', priceCash: 5 },
				{ id: 'bread', name: 'Bread', priceCash: 8 },
				{ id: 'phone', name: 'Cellphone', priceCash: 250 },
			])
			.describe('Initial shop catalog. Override per-server in nextvm.config.ts.'),
	}),

	server: (ctx) => {
		const config = ctx.config as {
			startingOffers: Array<{ id: string; name: string; priceCash: number }>
		}
		const service = new ShopService(config.startingOffers)
		const router = buildShopRouter(service)

		// Pull the banking adapter via DI. Banking is in the dependency
		// list, so its setExports() has already run when this fires.
		try {
			const banking = ctx.inject<{
				removeMoney: (charId: number, type: 'cash' | 'bank', amount: number) => Promise<number>
			}>('banking')
			service.setBanking(banking)
		} catch {
			ctx.log.warn('banking module not available — purchases disabled')
		}

		ctx.exposeRouter(router)

		ctx.log.info('shop loaded', { offers: service.list().length })
	},

	client: (ctx) => {
		ctx.log.info('shop module loaded (client)')
	},
})

export { buildShopRouter } from './server/router'
export { ShopService } from './server/service'
`

	const shopService = `export interface ShopOffer {
	id: string
	name: string
	priceCash: number
}

export interface BankingAdapter {
	removeMoney(charId: number, type: 'cash' | 'bank', amount: number): Promise<number>
}

/**
 * ShopService — pure business logic, no FiveM coupling.
 *
 * Maintains the catalog and processes purchases. The banking adapter
 * is optional so unit tests can run without a banking mock.
 */
export class ShopService {
	private offers: ShopOffer[]
	private banking: BankingAdapter | null = null

	constructor(initialOffers: ShopOffer[]) {
		this.offers = [...initialOffers]
	}

	setBanking(banking: BankingAdapter): void {
		this.banking = banking
	}

	list(): ShopOffer[] {
		return [...this.offers]
	}

	get(offerId: string): ShopOffer | undefined {
		return this.offers.find((o) => o.id === offerId)
	}

	async buy(charId: number, offerId: string): Promise<{ ok: true; offer: ShopOffer }> {
		const offer = this.get(offerId)
		if (!offer) {
			throw new Error(\`Unknown offer: \${offerId}\`)
		}
		if (!this.banking) {
			throw new Error('Banking module not wired up')
		}
		await this.banking.removeMoney(charId, 'cash', offer.priceCash)
		return { ok: true, offer }
	}
}
`

	const shopRouter = `import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { ShopService } from './service'

/**
 * Build the shop RPC router. The service is captured in the closure
 * so the router can access it without globals.
 */
export function buildShopRouter(service: ShopService) {
	return defineRouter({
		/** List all available offers */
		listOffers: procedure.query(() => service.list()),

		/** Buy a single item */
		buy: procedure
			.input(
				z.object({
					offerId: z.string().min(1),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				if (!ctx.charId) {
					throw new RpcError('NOT_FOUND', 'No active character')
				}
				try {
					return await service.buy(ctx.charId, input.offerId)
				} catch (err) {
					throw new RpcError(
						'VALIDATION_ERROR',
						err instanceof Error ? err.message : 'Purchase failed',
					)
				}
			}),
	})
}
`

	const shopTest = `import { describe, expect, it, vi } from 'vitest'
import { ShopService, type BankingAdapter } from '../src/server/service'

describe('ShopService', () => {
	const offers = [
		{ id: 'water', name: 'Water Bottle', priceCash: 5 },
		{ id: 'phone', name: 'Cellphone', priceCash: 250 },
	]

	it('lists every offer', () => {
		const service = new ShopService(offers)
		expect(service.list()).toHaveLength(2)
	})

	it('looks up a single offer by id', () => {
		const service = new ShopService(offers)
		expect(service.get('phone')?.priceCash).toBe(250)
		expect(service.get('missing')).toBeUndefined()
	})

	it('buy() throws on unknown offer', async () => {
		const service = new ShopService(offers)
		service.setBanking({ removeMoney: vi.fn() })
		await expect(service.buy(1, 'unknown')).rejects.toThrow(/Unknown offer/)
	})

	it('buy() throws when banking is not wired', async () => {
		const service = new ShopService(offers)
		await expect(service.buy(1, 'water')).rejects.toThrow(/Banking module not wired/)
	})

	it('buy() debits cash via the banking adapter', async () => {
		const removeMoney = vi.fn(async () => 100)
		const banking: BankingAdapter = { removeMoney }
		const service = new ShopService(offers)
		service.setBanking(banking)
		const result = await service.buy(42, 'phone')
		expect(result.ok).toBe(true)
		expect(result.offer.id).toBe('phone')
		expect(removeMoney).toHaveBeenCalledWith(42, 'cash', 250)
	})
})
`

	const shopPkg = {
		name: '@example/shop',
		version: '0.1.0',
		private: true,
		type: 'module',
		main: 'src/index.ts',
		scripts: {
			test: 'vitest run',
		},
	}

	return [
		{ path: 'package.json', contents: jsonFile(rootPkg) },
		{ path: 'tsconfig.json', contents: jsonFile(TSCONFIG) },
		{ path: 'nextvm.config.ts', contents: nextvmConfig },
		{ path: '.gitignore', contents: GITIGNORE },
		{ path: '.env.example', contents: ENV_EXAMPLE },
		{ path: 'README.md', contents: readme },

		// modules/core
		{ path: 'modules/core/package.json', contents: jsonFile(corePkg) },
		{ path: 'modules/core/src/index.ts', contents: coreIndex },
		{ path: 'modules/core/src/server.ts', contents: coreServer },
		{ path: 'modules/core/src/client.ts', contents: coreClient },

		// modules/shop
		{ path: 'modules/shop/package.json', contents: jsonFile(shopPkg) },
		{ path: 'modules/shop/src/index.ts', contents: shopIndex },
		{ path: 'modules/shop/src/server/service.ts', contents: shopService },
		{ path: 'modules/shop/src/server/router.ts', contents: shopRouter },
		{ path: 'modules/shop/__tests__/service.test.ts', contents: shopTest },
	]
}
