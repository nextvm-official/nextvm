import type { Command } from 'commander'
import { notImplemented } from '../utils/not-implemented'

/**
 * `nextvm deploy` — Deploy to managed hosting.
 *
 * Concept v2.3, Chapter 17 + 28.
 *
 * Stubbed: requires the managed hosting service (Phase 3 SaaS).
 */
export function registerDeployCommand(program: Command): void {
	program
		.command('deploy')
		.description('Deploy to NextVM managed hosting')
		.action(() => {
			notImplemented(
				'deploy',
				'Managed hosting target lands in Phase 3 (Concept Chapter 28).',
			)
		})
}
