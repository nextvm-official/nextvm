import { loadProject, runDev } from '@nextvm/build'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm dev` — Dev mode with file watching + incremental rebuilds.
 * Loads the project, kicks off the dev orchestrator (initial full build
 * + per-module file watcher), and stays alive until SIGINT.
 * State preservation across resource restarts and NUI HMR will land
 * with the runtime layer in . ships the file-watching
 * incremental rebuild loop that's safe to run alongside a manually
 * `ensure`d FXServer.
 */
export function registerDevCommand(program: Command): void {
	program
		.command('dev')
		.description('Dev mode: hot-reload, NUI HMR, file watching')
		.action(async () => {
			try {
				const project = await loadProject()
				const session = await runDev(project)

				const stop = async () => {
					cliLog.info('Stopping dev session...')
					await session.stop()
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
