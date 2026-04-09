import { loadProject, runBuild } from '@nextvm/build'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm build` — Production build (compile, bundle, manifests).
 *
 * Concept v2.3, Chapter 15.1 + 17.
 *
 * Loads the project at the current working directory, builds every
 * discovered module via @nextvm/build, and prints a structured summary.
 * Exits with code 1 on any build error.
 */
export function registerBuildCommand(program: Command): void {
	program
		.command('build')
		.description('Production build: compile, bundle, manifests')
		.option('--quiet', 'Suppress per-module output')
		.action(async (opts: { quiet?: boolean }) => {
			try {
				const project = await loadProject()
				const result = await runBuild(project, { verbose: !opts.quiet })

				if (result.errors.length > 0) {
					cliLog.error(`${result.errors.length} build error(s)`)
					for (const e of result.errors) cliLog.error(e)
					process.exit(1)
				}
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})
}
