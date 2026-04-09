import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseVerifiedWebhook, verifyTebexWebhook } from '../src'

const SECRET = 'test-secret'

const sign = (body: string): string =>
	createHmac('sha256', SECRET).update(body).digest('hex')

describe('verifyTebexWebhook', () => {
	it('accepts a correctly signed payload', () => {
		const body = '{"id":"abc","type":"payment.completed","date":"2026-04-07","subject":{}}'
		expect(verifyTebexWebhook(body, sign(body), SECRET)).toBe(true)
	})

	it('rejects a tampered payload', () => {
		const body = '{"id":"abc","type":"payment.completed","date":"2026-04-07","subject":{}}'
		const tampered = body.replace('abc', 'xyz')
		expect(verifyTebexWebhook(tampered, sign(body), SECRET)).toBe(false)
	})

	it('rejects a wrong signature', () => {
		const body = '{"id":"abc"}'
		expect(verifyTebexWebhook(body, 'deadbeef', SECRET)).toBe(false)
	})

	it('rejects when secret differs', () => {
		const body = '{"id":"abc"}'
		expect(verifyTebexWebhook(body, sign(body), 'other-secret')).toBe(false)
	})
})

describe('parseVerifiedWebhook', () => {
	it('returns the typed payload on a valid signed body', () => {
		const body = JSON.stringify({
			id: 'evt_1',
			type: 'payment.completed',
			date: '2026-04-07T00:00:00Z',
			subject: { transactionId: 'tx_1', total: 9.99 },
		})
		const event = parseVerifiedWebhook(body, sign(body), SECRET)
		expect(event).not.toBeNull()
		expect(event?.type).toBe('payment.completed')
	})

	it('returns null on signature mismatch', () => {
		const body = JSON.stringify({
			id: 'evt_1',
			type: 'payment.completed',
			date: '2026-04-07T00:00:00Z',
			subject: {},
		})
		expect(parseVerifiedWebhook(body, 'deadbeef', SECRET)).toBeNull()
	})

	it('throws on schema mismatch (signed but malformed)', () => {
		const body = JSON.stringify({ id: 'evt_1', type: 'unknown.event' })
		expect(() => parseVerifiedWebhook(body, sign(body), SECRET)).toThrow(
			/validation failed/,
		)
	})
})
