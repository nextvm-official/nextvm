/**
 * @nextvm/nui — typed message bus between the FiveM client runtime and a
 * NUI browser frame.
 *
 * Concept v2.3, Chapter 19.
 *
 * Two entry points:
 *
 *   import { NuiClient } from '@nextvm/nui/client'   // FiveM client side
 *   import { NuiBrowser } from '@nextvm/nui/browser' // NUI/React side
 *
 * Both sides speak the same wire protocol (see ./protocol.ts) so React
 * code stays decoupled from FiveM specifics and unit-testable in JSDOM.
 */

export { NuiClient } from './client'
export type { NuiClientOptions, NuiCallbackHandler } from './client'
export { NuiBrowser } from './browser'
export type { NuiBrowserOptions, NuiBrowserHandler } from './browser'
export { NEXTVM_RESPONSE_CALLBACK } from './protocol'
export type { NuiEnvelope, NuiResponseBody } from './protocol'
