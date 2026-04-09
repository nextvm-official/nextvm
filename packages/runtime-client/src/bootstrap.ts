import { createLogger, ModuleLoader, type ModuleDefinition } from '@nextvm/core'
import { RuntimeRpcTransport } from './rpc-transport'

/**
 * Bootstrap the NextVM client runtime.
 *   1. ModuleLoader registers every module
 *   2. RuntimeRpcTransport is created, wired to emitNet/onNet for the
 *      typed RPC client proxy
 *   3. ModuleLoader.initialize('client') runs every client entry +
 *      onModuleInit + onModuleReady
 *   4. FiveM client events are bridged:
 *        - playerSpawned → onMounted (the "framework is ready, the
 *          local player ped exists" hook 
 *        - onClientResourceStop → onModuleStop
 *   5. The managed tick loop is started via setTick
 * Returns a `ClientRuntimeHandle`. Production code calls `.stop()` only;
 * tests use the rest of the surface to drive the runtime deterministically.
 */
export interface BootstrapClientOptions {
	modules: ModuleDefinition[]
	/**
	 * Optional transport override. By default the runtime auto-wires a
	 * `RuntimeRpcTransport` against the FiveM client globals. Tests pass
	 * an in-memory transport here.
	 */
	transport?: RuntimeRpcTransport
}

export interface ClientRuntimeHandle {
	loader: ModuleLoader
	transport: RuntimeRpcTransport
	runFrame(now?: number): Promise<void>
	handleMounted(): Promise<void>
	stop(): Promise<void>
}

export async function bootstrapClient(
	opts: BootstrapClientOptions,
): Promise<ClientRuntimeHandle> {
	const log = createLogger('nextvm:runtime:client')

	const loader = new ModuleLoader()
	for (const mod of opts.modules) loader.register(mod)

	const fivem = detectClientGlobals()
	const transport =
		opts.transport ??
		(fivem
			? new RuntimeRpcTransport({
					emit: (event, ...args) => fivem.emitNet(event, ...args),
					subscribe: (event, handler) => fivem.onNet(event, handler),
				})
			: new RuntimeRpcTransport({
					emit: () => undefined,
					subscribe: () => undefined,
				}))

	await loader.initialize('client')

	let tickHandle: number | null = null
	const runtime: ClientRuntimeHandle = {
		loader,
		transport,
		runFrame: (now) => loader.getTickScheduler().runFrame(now).then(() => undefined),
		handleMounted: async () => {
			const map = loader.getLifecycleHandlers('onMounted')
			for (const [moduleName, handlers] of map) {
				for (const handler of handlers) {
					try {
						await handler()
					} catch (err) {
						loader.getErrorBoundary().report(moduleName, 'lifecycle', 'onMounted', err)
					}
				}
			}
		},
		stop: async () => {
			if (tickHandle !== null && fivem) fivem.clearTick(tickHandle)
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
			log.info('NextVM client runtime stopped')
		},
	}

	if (fivem) {
		fivem.on('playerSpawned', () => {
			void runtime.handleMounted()
		})
		fivem.on('onClientResourceStop', async (resource: unknown) => {
			if (resource === fivem.currentResource()) {
				await runtime.stop()
			}
		})
		tickHandle = fivem.setTick(() => {
			void loader.getTickScheduler().runFrame()
		})
		log.info('FiveM client event bridge attached')
	}

	log.info('NextVM client runtime ready', { modules: opts.modules.length })
	return runtime
}

interface ClientFivemBridge {
	on: (event: string, handler: (...args: unknown[]) => void) => void
	onNet: (event: string, handler: (...args: unknown[]) => void) => void
	emitNet: (event: string, ...args: unknown[]) => void
	setTick: (handler: () => void) => number
	clearTick: (id: number) => void
	currentResource: () => string
}

function detectClientGlobals(): ClientFivemBridge | null {
	const g = globalThis as Record<string, unknown>
	if (typeof g.on !== 'function' || typeof g.setTick !== 'function') return null
	return {
		on: g.on as ClientFivemBridge['on'],
		onNet: g.onNet as ClientFivemBridge['onNet'],
		emitNet: g.emitNet as ClientFivemBridge['emitNet'],
		setTick: g.setTick as ClientFivemBridge['setTick'],
		clearTick: g.clearTick as ClientFivemBridge['clearTick'],
		currentResource: () =>
			typeof g.GetCurrentResourceName === 'function'
				? (g.GetCurrentResourceName as () => string)()
				: 'nextvm',
	}
}
