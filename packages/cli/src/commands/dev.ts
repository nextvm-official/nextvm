import { loadProject, runDev } from '@nextvm/build'
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
		.action(async () => {
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

				const session = await runDev(project)

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
