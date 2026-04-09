import { z } from 'zod'

/**
 * Tebex API schemas.
 *
 * Concept v2.3, Chapter 4.3.3:
 *   "@nextvm/tebex provides typed integration with Tebex's server-side
 *    API (package fulfillment, gift cards, transaction verification)"
 *
 * These schemas mirror the public Tebex Headless API v2.
 * They are intentionally permissive (passthrough on unknown fields)
 * so the package keeps working when Tebex adds new fields.
 */

export const tebexPlayerSchema = z
	.object({
		uuid: z.string(),
		username: z.string().nullable(),
	})
	.passthrough()

export const tebexPriceSchema = z
	.object({
		amount: z.number(),
		currency: z.string(),
	})
	.passthrough()

export const tebexPackageSchema = z
	.object({
		id: z.number(),
		name: z.string(),
		description: z.string().nullable().optional(),
		image: z.string().nullable().optional(),
		base_price: z.number(),
		sales_tax: z.number().optional(),
		total_price: z.number(),
		currency: z.string(),
		discount: z.number().optional(),
		disable_quantity: z.boolean().optional(),
		disable_gifting: z.boolean().optional(),
		expiration_date: z.string().nullable().optional(),
		category: z
			.object({
				id: z.number(),
				name: z.string(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough()

export type TebexPackage = z.infer<typeof tebexPackageSchema>

export const tebexTransactionSchema = z
	.object({
		id: z.string(),
		amount: z.number(),
		status: z.enum(['complete', 'chargeback', 'refund']),
		date: z.string(),
		currency: z
			.object({
				iso_4217: z.string(),
				symbol: z.string(),
			})
			.passthrough(),
		player: tebexPlayerSchema,
		packages: z.array(
			z
				.object({
					id: z.number(),
					name: z.string(),
				})
				.passthrough(),
		),
	})
	.passthrough()

export type TebexTransaction = z.infer<typeof tebexTransactionSchema>

/** Webhook payload — sent by Tebex on payment events */
export const tebexWebhookPayloadSchema = z
	.object({
		id: z.string(),
		type: z.enum([
			'payment.completed',
			'payment.refunded',
			'payment.chargeback',
			'recurring-payment.started',
			'recurring-payment.renewed',
			'recurring-payment.cancelled',
		]),
		date: z.string(),
		subject: z.unknown(),
	})
	.passthrough()

export type TebexWebhookPayload = z.infer<typeof tebexWebhookPayloadSchema>

export type TebexEventType = TebexWebhookPayload['type']
