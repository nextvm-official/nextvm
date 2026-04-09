import { watch, type FSWatcher } from 'chokidar'
import { join } from 'node:path'
import pc from 'picocolors'
import { runBuild } from './build-orchestrator'
import { writeDevTrigger } from './dev-trigger'
import type { LoadedProject, ResolvedModule } from './project-loader'

/**
 * Dev orchestrator.
 *
 * Concept v2.3, Chapter 15.2:
 *   "Dev mode: hot-reload, NUI HMR, file watching"
 *
 * Phase 2 minimum: file watcher that rebuilds the affected module on
 * change. State preservation + NUI HMR + ensure-restart bridge follow
 * once the runtime layer is in place (Phase 4).
 *
 * Each module's `src/` is watched. On change, that single module is
 * rebuilt via the build orchestrator (skipLocales=true for speed) and
 * a `module:rebuilt` callback is fired so the runtime can `ensure`-
 * restart the resource.
 */

export interface DevOptions {
	/** Print colored progress to stdout */
	verbose?: boolean
	/** Debounce ms — coalesce file events into one rebuild */
	debounceMs?: number
	/** Called after each successful module rebuild */
	onModuleRebuilt?: (module: ResolvedModule) => void | Promise<void>
	/**
	 * Write a `.nextvm/dev-trigger.json` after each successful rebuild
	 * so a co-located runtime-server can `ExecuteCommand('ensure ...')`.
	 * Default: true.
	 */
	writeTriggerFile?: boolean
}

export interface DevSession {
	/** Stop the dev session and close all watchers */
	stop(): Promise<void>
	/** Number of currently watched modules */
	getWatchedCount(): number
}

export async function runDev(
	project: LoadedProject,
	options: DevOptions = {},
): Promise<DevSession> {
	const verbose = options.verbose ?? true
	const debounceMs = options.debounceMs ?? 200

	if (verbose) {
		console.log(pc.bold(pc.cyan(`\nNextVM dev — watching ${project.modules.length} module(s)\n`)))
	}

	// Initial full build so the dev session starts from a known state
	await runBuild(project, { verbose, skipLocales: false })

	const watchers: FSWatcher[] = []
	const pendingRebuilds = new Map<string, ReturnType<typeof setTimeout>>()

	for (const mod of project.modules) {
		const srcDir = join(mod.path, 'src')
		const watcher = watch(srcDir, {
			ignoreInitial: true,
			ignored: (path: string) => path.includes('node_modules') || path.includes('dist'),
		})

		const triggerRebuild = () => {
			const existing = pendingRebuilds.get(mod.name)
			if (existing) clearTimeout(existing)
			pendingRebuilds.set(
				mod.name,
				setTimeout(async () => {
					pendingRebuilds.delete(mod.name)
					if (verbose) {
						console.log(pc.dim(`\n[${new Date().toLocaleTimeString()}] `) + pc.cyan(`rebuilding ${mod.name}...`))
					}
					try {
						await runBuild(
							{ ...project, modules: [mod] },
							{ verbose: false, skipLocales: true },
						)
						if (verbose) console.log(`  ${pc.green('✓')} ${mod.name} rebuilt`)
						if (options.writeTriggerFile !== false) {
							try {
								writeDevTrigger(mod.name, { rootDir: project.rootDir })
							} catch (err) {
								if (verbose)
									console.error(
										`  ${pc.yellow('!')} dev-trigger write failed: ${err instanceof Error ? err.message : String(err)}`,
									)
							}
						}
						await options.onModuleRebuilt?.(mod)
					} catch (err) {
						console.error(
							`  ${pc.red('✗')} ${mod.name} build failed: ${err instanceof Error ? err.message : String(err)}`,
						)
					}
				}, debounceMs),
			)
		}

		watcher.on('add', triggerRebuild)
		watcher.on('change', triggerRebuild)
		watcher.on('unlink', triggerRebuild)
		watchers.push(watcher)
	}

	if (verbose) {
		console.log(pc.dim('\nPress Ctrl+C to stop.\n'))
	}

	return {
		async stop() {
			for (const t of pendingRebuilds.values()) clearTimeout(t)
			pendingRebuilds.clear()
			await Promise.all(watchers.map((w) => w.close()))
		},
		getWatchedCount() {
			return watchers.length
		},
	}
}
