import type { Command } from 'commander'
import { notImplemented } from '../utils/not-implemented'

/**
 * `nextvm perf` — Show runtime performance metrics.
 *
 * Concept v2.3, Chapter 17 + 21.
 *
 * Stubbed: requires the managed tick system + profiler integration.
 */
export function registerPerfCommand(program: Command): void {
	program
		.command('perf')
		.description('Show runtime performance metrics')
		.action(() => {
			notImplemented(
				'perf',
				'Profiler integration arrives with the Managed Tick System (Phase 2 Chapter 21).',
			)
		})
}
