import type { Command } from 'commander'
import { notImplemented } from '../utils/not-implemented'

/**
 * `nextvm deploy` — Deploy to managed hosting.
 * Stubbed: requires the managed hosting service.
 */
export function registerDeployCommand(program: Command): void {
	program
		.command('deploy')
		.description('Deploy to NextVM managed hosting')
		.action(() => {
			notImplemented(
				'deploy',
				'requires the managed hosting service.',
			)
		})
}
