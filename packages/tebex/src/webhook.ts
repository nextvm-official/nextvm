import { createHmac, timingSafeEqual } from 'node:crypto'
import {
	type TebexWebhookPayload,
	tebexWebhookPayloadSchema,
} from './schemas'

/**
 * Verify a Tebex webhook signature.
 *
 * Concept v2.3, Chapter 4.3.3 + Chapter 20.1 (Event Protection).
 *
 * Tebex signs every webhook with HMAC-SHA256 over the raw JSON body
 * using the project's webhook secret. We verify with `timingSafeEqual`
 * to avoid timing oracle attacks.
 *
 * GUARD-013: PLA compliance — every monetized module that consumes
 * Tebex webhooks MUST call this before trusting the payload.
 */
export function verifyTebexWebhook(
	rawBody: string,
	signature: string,
	secret: string,
): boolean {
	const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
	const a = Buffer.from(expected, 'utf8')
	const b = Buffer.from(signature, 'utf8')
	if (a.length !== b.length) return false
	return timingSafeEqual(a, b)
}

/**
 * Verify + parse a Tebex webhook in one shot.
 *
 * Returns the typed payload on success or null on signature mismatch.
 * Throws if the body is valid JSON but does not match the schema —
 * that indicates a Tebex API change and the caller should be loud.
 */
export function parseVerifiedWebhook(
	rawBody: string,
	signature: string,
	secret: string,
): TebexWebhookPayload | null {
	if (!verifyTebexWebhook(rawBody, signature, secret)) return null
	const json = JSON.parse(rawBody)
	const result = tebexWebhookPayloadSchema.safeParse(json)
	if (!result.success) {
		throw new Error(`Tebex webhook payload validation failed: ${result.error.message}`)
	}
	return result.data
}
