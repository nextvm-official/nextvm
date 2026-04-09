/**
 * Minimal interface this module needs from @nextvm/banking.
 *
 * Defining the contract here (and not importing the banking module
 * directly) keeps the dependency loose, satisfies GUARD-002, and
 * makes the housing service trivially testable with a stub.
 */
export interface BankingAdapter {
	removeMoney(
		charId: number,
		type: 'cash' | 'bank',
		amount: number,
		reason?: string,
	): Promise<number>
}
