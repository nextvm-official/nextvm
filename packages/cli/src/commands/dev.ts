import { loadProject, runDev } from '@nextvm/build'
import { FxserverRunner } from '@nextvm/fxserver-runner'
import type { Command } from 'commander'
import pc from 'picocolors'
import { cliLog } from '../utils/logger'

/**
 * `nextvm dev` — Dev mode with file watching + incremental rebuilds.
 *
 * Loads the project, kicks off the dev orchestrator (initial full build
 * + per-module file watcher), and stays alive until SIGINT.
 */
export function registerDevCommand(program: Command): void {
	program
		.command('dev')
		.description('Dev mode: hot-reload, file watching, incremental rebuilds')
		.option('--serve', 'Also spawn a local FXServer subprocess (requires fxserver block in config)')
		.action(async (opts: { serve?: boolean }) => {
			try {
				cliLog.banner('0.0.2', 'dev — watching modules for changes')

				const project = await loadProject()
				const moduleCount = project.modules.length

				if (moduleCount === 0) {
					// Friendly empty-state guide instead of silently watching
					// nothing.
					cliLog.warn('No modules found in this project yet.')
					cliLog.br()
					cliLog.plain(`${pc.bold('Add your first module:')}`)
					cliLog.step(
						`${pc.cyan('pnpm add:module')} ${pc.yellow('shop')} ${pc.dim('--full')}`,
					)
					cliLog.br()
					cliLog.plain(
						`${pc.bold('Or scaffold a starter project with everything pre-wired:')}`,
					)
					cliLog.step(
						`${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('my-server')} ${pc.dim('--template starter')}`,
					)
					cliLog.br()
					cliLog.plain(
						`${pc.dim('Watching')} ${pc.cyan('modules/')} ${pc.dim('— drop a module folder in and it will be picked up automatically.')}`,
					)
					cliLog.br()
				}

				// Optional FXServer subprocess. When --serve is passed, we
				// spin up the runner BEFORE runDev() so the initial build
				// completes against an already-running FXServer that we can
				// then `ensure` per-module on hot-reload.
				let runner: FxserverRunner | null = null
				if (opts.serve) {
					const fx = project.config.fxserver
					if (!fx) {
						cliLog.error(
							'`--serve` requires a `fxserver` block in nextvm.config.ts.',
						)
						process.exit(1)
					}
					runner = new FxserverRunner({
						fxserverPath: fx.path,
						fxserverDataPath: fx.dataPath,
						projectRoot: project.rootDir,
						modules: project.modules.map((m) => ({ name: m.name, path: m.path })),
						serverCfg: {
							hostname: project.config.server.name,
							maxClients: project.config.server.maxPlayers,
							endpoint: fx.endpoint,
							gameBuild: fx.gameBuild,
							licenseKey: fx.licenseKey ?? process.env.CFX_LICENSE_KEY,
							additionalResources: fx.additionalResources,
							convars: fx.convars,
						},
						onLog: (line, source) => {
							const tag = source === 'fxserver' ? pc.cyan('[fx]') : pc.dim('[runner]')
							cliLog.plain(`${tag} ${line}`)
						},
					})
				}

				const session = await runDev(project, {
					// When --serve is active, the runner's ensure() handles
					// the dev-trigger write exclusively. Disable the
					// orchestrator's own trigger so there's only ONE write
					// per rebuild cycle — avoids double fs.watch events.
					writeTriggerFile: !runner,
					onModuleRebuilt: runner
						? (mod) => {
								try {
									runner!.ensure(mod.name)
								} catch (err) {
									cliLog.warn(
										`ensure ${mod.name} failed: ${err instanceof Error ? err.message : String(err)}`,
									)
								}
							}
						: undefined,
				})

				if (runner) {
					await runner.start()
					cliLog.success(`FXServer running (PID ${runner.getPid()})`)
				}

				if (moduleCount > 0) {
					cliLog.success(
						`Watching ${pc.bold(String(moduleCount))} module${moduleCount === 1 ? '' : 's'} for changes`,
					)
				}
				cliLog.dim('Press Ctrl+C to stop.')
				cliLog.br()

				const stop = async () => {
					cliLog.br()
					cliLog.info('Stopping dev session…')
					await session.stop()
					if (runner) {
						cliLog.info('Stopping FXServer…')
						await runner.stop()
					}
					cliLog.success('Stopped cleanly.')
					process.exit(0)
				}
				process.on('SIGINT', stop)
				process.on('SIGTERM', stop)
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})
}
