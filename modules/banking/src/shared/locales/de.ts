import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
	'banking.transfer_success': '{amount}€ an {target} überwiesen.',
	'banking.transfer_failed': 'Überweisung fehlgeschlagen: {reason}.',
	'banking.insufficient_funds': 'Nicht genug Geld.',
	'banking.balance': 'Bargeld: {cash}€ — Bank: {bank}€',
})
