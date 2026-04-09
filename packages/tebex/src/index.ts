/**
 * @nextvm/tebex — Typed Tebex API bridge for NextVM
 *
 * Concept v2.3, Chapter 4.3.3 + 26.
 *
 * The single PLA-compliant payment integration for NextVM modules.
 * Every module that sells in-game items to players for real money
 * MUST consume this package and ship a MONETIZATION.md (GUARD-013).
 *
 * Usage:
 *   import { TebexClient, parseVerifiedWebhook } from '@nextvm/tebex'
 *
 *   const tebex = new TebexClient({ secret: process.env.TEBEX_SECRET! })
 *   const pkg = await tebex.getPackage(12345)
 *
 *   // In your webhook handler:
 *   const event = parseVerifiedWebhook(rawBody, headers['x-signature'], secret)
 *   if (event?.type === 'payment.completed') {
 *     await fulfillInGameItems(event.subject)
 *   }
 */

export { TebexClient } from './client'
export type { TebexClientOptions } from './client'

export { verifyTebexWebhook, parseVerifiedWebhook } from './webhook'

export { defaultFetcher } from './http'
export type { Fetcher, FetcherRequest, FetcherResponse } from './http'

export {
	tebexPackageSchema,
	tebexTransactionSchema,
	tebexWebhookPayloadSchema,
	tebexPlayerSchema,
	tebexPriceSchema,
} from './schemas'
export type {
	TebexPackage,
	TebexTransaction,
	TebexWebhookPayload,
	TebexEventType,
} from './schemas'

export { MONETIZATION_TEMPLATE } from './monetization-template'
