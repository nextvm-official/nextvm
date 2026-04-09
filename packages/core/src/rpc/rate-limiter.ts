/**
 * Per-player per-procedure rate limiter.
 *
 * Concept v2.3, Chapter 10.3:
 *   "Every RPC: rate-limited per player"
 *
 * Uses a token-bucket algorithm:
 *   - Each player+procedure pair has its own bucket
 *   - Bucket refills at a fixed rate
 *   - Each call consumes one token
 *   - Empty bucket → RATE_LIMITED error
 *
 * GUARD-006 compliant: instance state, no globals.
 */
export class RateLimiter {
	private buckets = new Map<string, { tokens: number; lastRefill: number }>()

	constructor(
		/** Maximum tokens per bucket */
		private readonly capacity: number = 60,
		/** Tokens added per second */
		private readonly refillRate: number = 30,
	) {}

	/**
	 * Try to consume a token for a player+procedure pair.
	 * Returns true if allowed, false if rate-limited.
	 */
	tryConsume(source: number, procedureKey: string): boolean {
		const key = `${source}:${procedureKey}`
		const now = Date.now()

		let bucket = this.buckets.get(key)
		if (!bucket) {
			bucket = { tokens: this.capacity, lastRefill: now }
			this.buckets.set(key, bucket)
		}

		// Refill based on elapsed time
		const elapsed = (now - bucket.lastRefill) / 1000
		bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate)
		bucket.lastRefill = now

		if (bucket.tokens >= 1) {
			bucket.tokens -= 1
			return true
		}
		return false
	}

	/** Clear all rate limit state for a player (on disconnect) */
	clearPlayer(source: number): void {
		const prefix = `${source}:`
		for (const key of this.buckets.keys()) {
			if (key.startsWith(prefix)) {
				this.buckets.delete(key)
			}
		}
	}

	/** Reset all rate limit state */
	reset(): void {
		this.buckets.clear()
	}
}
