import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
	'banking.transfer_success': 'Transferred ${amount} to {target}.',
	'banking.transfer_failed': 'Transfer failed: {reason}.',
	'banking.insufficient_funds': 'Insufficient funds.',
	'banking.balance': 'Cash: ${cash} — Bank: ${bank}',
})
