import type { Command } from 'commander'
import { notImplemented } from '../utils/not-implemented'

/**
 * `nextvm perf` — Show runtime performance metrics.
 * Stubbed: requires the managed tick system + profiler integration.
 */
export function registerPerfCommand(program: Command): void {
	program
		.command('perf')
		.description('Show runtime performance metrics')
		.action(() => {
			notImplemented(
				'perf',
				'Profiler integration arrives with the Managed Tick System.',
			)
		})
}
