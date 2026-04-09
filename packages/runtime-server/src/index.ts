/**
 * @nextvm/runtime-server — Server runtime bootstrap.
 * Importing this package gives you a single function — `bootstrapServer` —
 * that wires every NextVM core service to the live FiveM event surface.
 * It's the missing "last mile" between a built module bundle and a
 * running FXServer.
 * Minimal example (server.ts inside a NextVM resource):
 *   import { bootstrapServer } from '@nextvm/runtime-server'
 *   import banking from '@nextvm/banking'
 *   import jobs from '@nextvm/jobs'
 *   await bootstrapServer({
 *     modules: [banking, jobs],
 *   })
 */

export { bootstrapServer } from './bootstrap'
export type { BootstrapOptions, RuntimeHandle } from './types'
export { FivemExportsApi } from './fivem-exports-api'
export { readPlayerIdentifiers } from './identifiers'
export { buildCompatDataSource } from './compat-data-source'
export type {
	RuntimeCompatDataSource,
	RuntimeCompatCharacterSnapshot,
} from './compat-data-source'
export {
	writeStateSnapshot,
	restoreStateSnapshot,
	defaultSnapshotIo,
} from './state-snapshot'
export type { SnapshotEnvelope, SnapshotIo, SnapshotOptions } from './state-snapshot'
export { startDevBridge } from './dev-bridge'
export type { DevBridgeHandle, DevBridgeIo, DevBridgeOptions, DevTrigger } from './dev-bridge'
