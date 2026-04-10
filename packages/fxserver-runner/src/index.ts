/**
 * @nextvm/fxserver-runner — spawn and manage a local FXServer process
 * for NextVM dev workflows.
 *
 * Used by `nextvm serve` and `nextvm dev --serve` to:
 *   - Link built modules into <fxserver>/resources/[nextvm]/
 *   - Generate <fxserver>/server.cfg.nextvm from project config
 *   - Spawn FXServer with `+exec server.cfg.nextvm`
 *   - Stream subprocess logs into the CLI
 *   - Trigger hot-reload via the existing dev-bridge file protocol
 *   - Clean up symlinks + subprocess on stop
 *
 * Example:
 *
 *   import { FxserverRunner } from '@nextvm/fxserver-runner'
 *
 *   const runner = new FxserverRunner({
 *     fxserverPath: 'C:/fivem-server',
 *     projectRoot: process.cwd(),
 *     modules: [{ name: 'banking', path: '/abs/path/modules/banking' }],
 *     serverCfg: {
 *       hostname: 'My Dev Server',
 *       maxClients: 32,
 *       endpoint: '0.0.0.0:30120',
 *       licenseKey: process.env.CFX_LICENSE_KEY,
 *     },
 *     onLog: (line, source) => console.log(`[${source}] ${line}`),
 *   })
 *
 *   await runner.start()
 *   // ... watch files, call runner.ensure('banking') on change ...
 *   await runner.stop()
 */

export { FxserverRunner } from './runner'
export { generateServerCfg } from './server-cfg'
export { linkModules } from './linker'
export { resolveFxserverBinary, spawnFxserver } from './subprocess'
export { defaultIo } from './default-io'
export {
	resolveRecommendedBuild,
	downloadFxserver,
	cloneServerData,
	readStoredBuild,
	writeStoredBuild,
} from './download'
export type { ResolvedBuild } from './download'
export type {
	RunnerIo,
	RunnerModule,
	RunnerOptions,
	RunnerState,
	ServerCfgInput,
	SpawnedProcess,
} from './types'
export type { LinkOptions, LinkResult } from './linker'
export type { SpawnFxserverOptions } from './subprocess'
