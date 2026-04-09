/**
 * Type-only helper for defining a module's public service surface.
 * Modules expose their service API to other modules via `ctx.setExports()`.
 * `defineExports()` is a passthrough that anchors the type so the same
 * shape can be re-imported by consumers as the typed argument to
 * `ctx.inject<T>()`.
 * Usage:
 *   // banking/src/index.ts
 *   export type BankingExports = ReturnType<typeof buildExports>
 *   const buildExports = (service: BankingService) => defineExports({
 *     service,
 *     transfer: (...args) => service.transfer(...args),
 *   })
 *   server: (ctx) => {
 *     const service = new BankingService()
 *     ctx.setExports(buildExports(service))
 *   }
 *   // jobs/src/index.ts (consumer)
 *   import type { BankingExports } from '@nextvm/banking'
 *   server: (ctx) => {
 *     const banking = ctx.inject<BankingExports>('banking')
 *     await banking.transfer(...)
 *   }
 */
export function defineExports<T extends Record<string, unknown>>(exports: T): T {
	return exports
}
