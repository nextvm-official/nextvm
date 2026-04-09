/**
 * @nextvm/runtime-client — Client runtime bootstrap.
 * Mirror of @nextvm/runtime-server for the client side. A single
 * `bootstrapClient()` call wires the ModuleLoader, the typed RPC
 * transport, and FiveM client events into one start function.
 *   import { bootstrapClient } from '@nextvm/runtime-client'
 *   import banking from '@nextvm/banking'
 *   await bootstrapClient({ modules: [banking] })
 */

export { bootstrapClient } from './bootstrap'
export type { BootstrapClientOptions, ClientRuntimeHandle } from './bootstrap'
export { RuntimeRpcTransport } from './rpc-transport'
export type { RpcTransportOptions } from './rpc-transport'
