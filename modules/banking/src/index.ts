/**
 * @nextvm/banking
 * Provides cash + bank accounts, transfers between characters, and an
 * audit trail in nextv_banking_transactions. Other modules consume this
 * via DI (`ctx.inject('banking')`) — never via direct import.
 * Server-authoritative, Zod-validated RPC inputs,
 * char-id scoped, i18n strings.
 * PLA: in-game money only. Modules that sell items to players for real
 * currency must integrate via @nextvm/tebex and ship their
 * own MONETIZATION.md.
 */

import { defineExports, defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import { buildBankingRouter } from './router'
import { BankingService } from './service'

/**
 * The public service surface this module exposes via DI.
 * Other modules (jobs, housing, ...) consume this by calling
 * `ctx.inject<BankingExports>('banking')`.
 */
export type BankingExports = ReturnType<typeof buildBankingExports>

function buildBankingExports(service: BankingService) {
	return defineExports({
		service,
		addMoney: service.addMoney.bind(service),
		removeMoney: service.removeMoney.bind(service),
		transfer: service.transfer.bind(service),
		getBalance: service.get.bind(service),
	})
}

export default defineModule({
	name: 'banking',
	version: '0.1.0',
	dependencies: ['player'],

	config: z.object({
		startingCash: z
			.number()
			.int()
			.min(0)
			.default(500)
			.describe('Cash given to a fresh character on first spawn'),
		startingBank: z
			.number()
			.int()
			.min(0)
			.default(2500)
			.describe('Bank balance given to a fresh character on first spawn'),
	}),

	server: (ctx) => {
		const config = ctx.config as { startingCash: number; startingBank: number }
		const service = new BankingService()
		const router = buildBankingRouter(service)

		ctx.log.info('banking module loaded (server)', {
			procedures: Object.keys(router).length,
			startingCash: config.startingCash,
			startingBank: config.startingBank,
		})

		ctx.onPlayerReady(async (player) => {
			const charId = player.character.id
			service.seed(charId, {
				cash: config.startingCash,
				bank: config.startingBank,
			})
		})

		ctx.onPlayerDropped(async (_player) => {
			// Persistence is handled by the character save flow; we just
			// drop the in-memory ledger entry to free memory.
		})

		// Publish the public surface so jobs/housing/... can pick it up
		// via `ctx.inject<BankingExports>('banking')`.
		ctx.setExports(buildBankingExports(service))
		// Hand the router to the runtime so client RPCs land here.
		ctx.exposeRouter(router)
	},

	client: (ctx) => {
		ctx.log.info('banking module loaded (client)')
	},

	shared: {
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

export { BankingService } from './service'
export { buildBankingRouter } from './router'
export { bankingInitialMigration, transactionsTable } from './schema'
export type { TransactionType } from './schema'
