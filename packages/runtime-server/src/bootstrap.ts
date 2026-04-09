import {
	CharacterService,
	createLogger,
	type DeferralHandle,
	ModuleLoader,
	type PlayerInfo,
	RpcRouter,
} from '@nextvm/core'
import { buildCompatDataSource } from './compat-data-source'
import { startDevBridge, type DevBridgeHandle } from './dev-bridge'
import { FivemExportsApi } from './fivem-exports-api'
import { readPlayerIdentifiers } from './identifiers'
import { InMemoryRuntimeCharacterRepository } from './in-memory-character-repository'
import { restoreStateSnapshot, writeStateSnapshot } from './state-snapshot'
import type { BootstrapOptions, RuntimeHandle } from './types'

/**
 * Bootstrap the NextVM server runtime inside an FXServer resource.
 *   1. ModuleLoader registers every module
 *   2. CharacterService is wired to a repository (DB-backed if a real
 *      one was passed, in-memory otherwise)
 *   3. RpcRouter is wired with the character resolver + profiler
 *   4. ModuleLoader.initialize('server') runs every server entry +
 *      onModuleInit + onModuleReady
 *   5. FiveM event handlers are registered: playerConnecting,
 *      playerJoining, playerDropped, the typed RPC net event, and
 *      onResourceStop for graceful shutdown
 *   6. The managed tick loop is started via setTick
 *   7. Optional: @nextvm/compat is registered with a FiveM-backed
 *      ExportsApi
 * Returns a RuntimeHandle. Production code only ever calls `.stop()`;
 * tests use the rest of the handle to drive the runtime deterministically
 * without spinning up a real FXServer.
 */
export async function bootstrapServer(opts: BootstrapOptions): Promise<RuntimeHandle> {
	const log = createLogger('nextvm:runtime')

	// 1. Loader + character service + rpc router
	const loader = new ModuleLoader()
	for (const mod of opts.modules) loader.register(mod)

	const characters = new CharacterService({
		repository: opts.characterRepository ?? new InMemoryRuntimeCharacterRepository(),
	})
	const rpc = new RpcRouter()
	rpc.setCharIdResolver((source) => characters.getCharacterId(source))
	rpc.setProfiler(loader.getProfiler())
	rpc.setErrorReporter((module, procedure, err) => {
		loader.getErrorBoundary().report(module, 'rpc-handler', procedure, err)
	})

	// 2. Initialize modules (server side). Must run before any FiveM
	// events fire so module routers are registered before we accept RPCs.
	await loader.initialize('server')

	// 2a. Auto-register every module router exposed via ctx.exposeRouter()
	// onto the runtime's RpcRouter under the module's name. This is the
	// glue that lets `dispatchRpc('banking', 'transfer', ...)` actually
	// reach the banking module without modules ever touching the rpc
	// instance directly. 1.
	for (const [moduleName, router] of loader.getExposedRouters()) {
		rpc.register(moduleName, router)
		log.info('Registered RPC router', { module: moduleName })
	}

	// 2b. Restore state from a hot-reload snapshot if a fresh one exists
	//. Runs after initialize() so every state
	// store is fully wired before we touch it.
	const snapshotOpts = opts.stateSnapshot
	if (snapshotOpts !== false) {
		const restored = restoreStateSnapshot(loader, {
			...(snapshotOpts ?? {}),
			log: (msg, data) => log.info(msg, data),
		})
		if (restored > 0) {
			log.info('Hot-reload state restored', { stores: restored })
		}
	}

	// 3. Compat layer (optional)
	if (opts.registerCompat) {
		const exportsApi = new FivemExportsApi()
		const dataSource = buildCompatDataSource(characters, readPlayerIdentifiers)
		opts.registerCompat({ exportsApi, dataSource })
		log.info('Compat layer registered')
	}

	// 4. FiveM event bridge — only when running inside an FXServer
	const fivem = detectFivemGlobals()
	let tickHandle: number | null = null
	let devBridgeHandle: DevBridgeHandle | null = null

	// 4a. Optional dev bridge — watches `.nextvm/dev-trigger.json` and
	// runs `ExecuteCommand('ensure <module>')` whenever the build
	// orchestrator writes a fresh trigger.
	if (opts.devBridge) {
		const devOpts = opts.devBridge === true ? {} : opts.devBridge
		devBridgeHandle = startDevBridge({
			...devOpts,
			log: (msg, data) => log.info(msg, data),
		})
		log.info('Dev bridge started', {
			path: devOpts.path ?? '.nextvm/dev-trigger.json',
		})
	}
	const runtime: RuntimeHandle = {
		loader,
		runFrame: (now) => loader.getTickScheduler().runFrame(now).then(() => undefined),
		handlePlayerConnecting: async (src, name, deferrals) => {
			const ids = readPlayerIdentifiers(src)
			if (!ids.license) {
				log.warn('Player has no license identifier; skipping', { source: src, name })
				return
			}
			await characters.loadOrCreateUser({
				source: src,
				license: ids.license,
				discord: ids.discord,
				steam: ids.steam,
			})
			const handle: DeferralHandle = deferrals
				? {
						defer: deferrals.defer,
						update: () => undefined,
						done: deferrals.done,
				  }
				: { defer: () => undefined, update: () => undefined, done: () => undefined }
			await runConnectingHandlers(loader, name, handle, src)
		},
		handlePlayerReady: async (src) => {
			const session = characters.getSession(src)
			if (!session?.character) {
				log.warn('handlePlayerReady called without active character', { source: src })
				return
			}
			const player: PlayerInfo = {
				source: src,
				user: { id: session.user.id },
				character: { id: session.character.id },
			}
			await runPlayerHandlers(loader, 'onPlayerReady', player)
		},
		handlePlayerDropped: async (src, reason) => {
			const session = characters.getSession(src)
			if (session?.character) {
				const player: PlayerInfo = {
					source: src,
					user: { id: session.user.id },
					character: { id: session.character.id },
				}
				await runDroppedHandlers(loader, player, reason)
			}
			await characters.saveAndRemoveSession(src).catch((err: unknown) => {
				log.error('Failed to save session on disconnect', {
					source: src,
					error: err instanceof Error ? err.message : String(err),
				})
			})
		},
		dispatchRpc: (src, namespace, procedure, input) =>
			rpc.dispatch(src, namespace, procedure, input),
		stop: async () => {
			if (tickHandle !== null && fivem) fivem.clearTick(tickHandle)
			devBridgeHandle?.stop()
			// Snapshot state BEFORE running onModuleStop hooks so modules
			// that clear their state on stop don't blow away the snapshot.
			if (snapshotOpts !== false) {
				try {
					writeStateSnapshot(loader, {
						...(snapshotOpts ?? {}),
						log: (msg, data) => log.info(msg, data),
					})
				} catch (err) {
					log.error('Failed to write state snapshot', {
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}
			await runStopHandlers(loader)
			log.info('NextVM runtime stopped')
		},
	}

	if (fivem) {
		fivem.on('playerConnecting', async (...args: unknown[]) => {
			const src = fivem.source()
			const name = String(args[0] ?? '')
			const deferralsObj = args[2] as
				| { defer: () => void; done: (reason?: string) => void }
				| undefined
			await runtime.handlePlayerConnecting(src, name, deferralsObj)
		})
		fivem.on('playerJoining', async () => {
			await runtime.handlePlayerReady(fivem.source())
		})
		fivem.on('playerDropped', async (...args: unknown[]) => {
			const src = fivem.source()
			const reason = String(args[0] ?? 'unknown')
			await runtime.handlePlayerDropped(src, reason)
		})
		fivem.onNet('__nextvm:rpc', async (...args: unknown[]) => {
			const src = fivem.source()
			const [namespace, procedure, input, requestId] = args as [
				string,
				string,
				unknown,
				number,
			]
			try {
				const result = await runtime.dispatchRpc(src, namespace, procedure, input)
				fivem.emitNet('__nextvm:rpc:response', src, requestId, null, result)
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				fivem.emitNet('__nextvm:rpc:response', src, requestId, message, null)
			}
		})
		fivem.on('onResourceStop', async (resource: unknown) => {
			if (resource === fivem.currentResource()) {
				await runtime.stop()
			}
		})
		tickHandle = fivem.setTick(() => {
			void loader.getTickScheduler().runFrame()
		})
		log.info('FiveM event bridge attached')
	}

	log.info('NextVM server runtime ready', { modules: opts.modules.length })
	return runtime
}

async function runConnectingHandlers(
	loader: ModuleLoader,
	name: string,
	deferrals: DeferralHandle,
	source: number,
): Promise<void> {
	const map = loader.getLifecycleHandlers('onPlayerConnecting')
	for (const [moduleName, handlers] of map) {
		for (const handler of handlers) {
			try {
				await handler(name, deferrals, source)
			} catch (err) {
				loader.getErrorBoundary().report(moduleName, 'lifecycle', 'onPlayerConnecting', err)
			}
		}
	}
}

async function runPlayerHandlers(
	loader: ModuleLoader,
	hook: 'onPlayerReady',
	player: PlayerInfo,
): Promise<void> {
	const map = loader.getLifecycleHandlers(hook)
	for (const [moduleName, handlers] of map) {
		for (const handler of handlers) {
			try {
				await handler(player)
			} catch (err) {
				loader.getErrorBoundary().report(moduleName, 'lifecycle', hook, err)
			}
		}
	}
}

async function runDroppedHandlers(
	loader: ModuleLoader,
	player: PlayerInfo,
	reason: string,
): Promise<void> {
	const map = loader.getLifecycleHandlers('onPlayerDropped')
	for (const [moduleName, handlers] of map) {
		for (const handler of handlers) {
			try {
				await handler(player, reason)
			} catch (err) {
				loader.getErrorBoundary().report(moduleName, 'lifecycle', 'onPlayerDropped', err)
			}
		}
	}
}

async function runStopHandlers(loader: ModuleLoader): Promise<void> {
	const map = loader.getLifecycleHandlers('onModuleStop')
	for (const [moduleName, handlers] of map) {
		for (const handler of handlers) {
			try {
				await handler()
			} catch (err) {
				loader.getErrorBoundary().report(moduleName, 'lifecycle', 'onModuleStop', err)
			}
		}
	}
}

interface FivemBridge {
	on: (event: string, handler: (...args: unknown[]) => void) => void
	onNet: (event: string, handler: (...args: unknown[]) => void) => void
	emitNet: (event: string, target: number, ...args: unknown[]) => void
	setTick: (handler: () => void) => number
	clearTick: (id: number) => void
	source: () => number
	currentResource: () => string
}

function detectFivemGlobals(): FivemBridge | null {
	const g = globalThis as Record<string, unknown>
	if (typeof g.on !== 'function' || typeof g.setTick !== 'function') return null
	return {
		on: g.on as FivemBridge['on'],
		onNet: g.onNet as FivemBridge['onNet'],
		emitNet: g.emitNet as FivemBridge['emitNet'],
		setTick: g.setTick as FivemBridge['setTick'],
		clearTick: g.clearTick as FivemBridge['clearTick'],
		source: () => Number((globalThis as Record<string, unknown>).source ?? 0),
		currentResource: () =>
			typeof g.GetCurrentResourceName === 'function'
				? (g.GetCurrentResourceName as () => string)()
				: 'nextvm',
	}
}
