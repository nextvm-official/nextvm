import { watch, type FSWatcher } from 'chokidar'
import { join } from 'node:path'
import pc from 'picocolors'
import { runBuild } from './build-orchestrator'
import { writeDevTrigger } from './dev-trigger'
import type { LoadedProject, ResolvedModule } from './project-loader'

/**
 * Dev orchestrator.
 *
 * Watches each module's `src/` directory. On change, the affected
 * module is rebuilt incrementally via the build orchestrator
 * (skipLocales=true for speed) and a `module:rebuilt` callback is
 * fired so a co-located runtime-server can `ensure`-restart the
 * resource.
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

/** Format a number of milliseconds for human reading. */
function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	return `${(ms / 1000).toFixed(2)}s`
}

/** Format a wallclock timestamp for log lines. */
function timestamp(): string {
	const now = new Date()
	const hh = String(now.getHours()).padStart(2, '0')
	const mm = String(now.getMinutes()).padStart(2, '0')
	const ss = String(now.getSeconds()).padStart(2, '0')
	return `${hh}:${mm}:${ss}`
}

export async function runDev(
	project: LoadedProject,
	options: DevOptions = {},
): Promise<DevSession> {
	const verbose = options.verbose ?? true
	const debounceMs = options.debounceMs ?? 200

	// Initial full build so the dev session starts from a known state.
	// The CLI's `nextvm dev` command prints the banner — we don't want
	// to duplicate it here, so this build is silent.
	if (verbose && project.modules.length > 0) {
		console.log(`  ${pc.dim('›')} Initial build of ${pc.bold(String(project.modules.length))} module(s)…`)
	}
	const buildStart = Date.now()
	await runBuild(project, { verbose: false, skipLocales: false })
	if (verbose && project.modules.length > 0) {
		console.log(
			`  ${pc.green('✓')} Initial build completed in ${pc.dim(formatMs(Date.now() - buildStart))}`,
		)
		console.log()
	}

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
					const start = Date.now()
					if (verbose) {
						console.log(
							`  ${pc.dim(timestamp())} ${pc.cyan('●')} Rebuilding ${pc.bold(mod.name)}…`,
						)
					}
					try {
						await runBuild(
							{ ...project, modules: [mod] },
							{ verbose: false, skipLocales: true },
						)
						const elapsed = Date.now() - start
						if (verbose) {
							console.log(
								`  ${pc.dim(timestamp())} ${pc.green('✓')} ${pc.bold(mod.name)} rebuilt in ${pc.dim(formatMs(elapsed))}`,
							)
						}
						if (options.writeTriggerFile !== false) {
							try {
								writeDevTrigger(mod.name, { rootDir: project.rootDir })
							} catch (err) {
								if (verbose) {
									console.error(
										`  ${pc.dim(timestamp())} ${pc.yellow('⚠')} dev-trigger write failed: ${
											err instanceof Error ? err.message : String(err)
										}`,
									)
								}
							}
						}
						await options.onModuleRebuilt?.(mod)
					} catch (err) {
						console.error(
							`  ${pc.dim(timestamp())} ${pc.red('✗')} ${pc.bold(mod.name)} build failed: ${
								err instanceof Error ? err.message : String(err)
							}`,
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
