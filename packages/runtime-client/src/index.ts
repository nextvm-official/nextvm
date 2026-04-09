/**
 * @nextvm/runtime-client — Client runtime bootstrap.
 *
 * Concept v2.3, Chapter 8.3 + 10.2 + 21.1.
 *
 * Mirror of @nextvm/runtime-server for the client side. A single
 * `bootstrapClient()` call wires the ModuleLoader, the typed RPC
 * transport, and FiveM client events into one start function.
 *
 *   import { bootstrapClient } from '@nextvm/runtime-client'
 *   import banking from '@nextvm/banking'
 *
 *   await bootstrapClient({ modules: [banking] })
 */

export { bootstrapClient } from './bootstrap'
export type { BootstrapClientOptions, ClientRuntimeHandle } from './bootstrap'
export { RuntimeRpcTransport } from './rpc-transport'
export type { RpcTransportOptions } from './rpc-transport'
