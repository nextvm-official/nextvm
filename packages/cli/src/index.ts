/**
 * @nextvm/cli — NextVM Command Line Interface
 */
import { Command } from 'commander'
import { registerAddCommand } from './commands/add'
import { registerBuildCommand } from './commands/build'
import { registerCreateCommand } from './commands/create'
import { registerDbCommands } from './commands/db'
import { registerDeployCommand } from './commands/deploy'
import { registerDocsCommand } from './commands/docs'
import { registerDevCommand } from './commands/dev'
import { registerMigrateFromCommand } from './commands/migrate-from'
import { registerPerfCommand } from './commands/perf'
import { registerRegistryCommands } from './commands/registry'
import { registerServeCommand } from './commands/serve'
import { registerValidateCommand } from './commands/validate'

/**
 * Build the root commander program with all NextVM commands registered.
 */
export function createCli(): Command {
	const program = new Command()
		.name('nextvm')
		.description('NextVM — A Next-Generation FiveM Framework CLI')
		.version('0.0.1')

	registerCreateCommand(program)
	registerAddCommand(program)
	registerDevCommand(program)
	registerServeCommand(program)
	registerBuildCommand(program)
	registerValidateCommand(program)
	registerDbCommands(program)
	registerDocsCommand(program)
	registerMigrateFromCommand(program)
	registerDeployCommand(program)
	registerPerfCommand(program)
	registerRegistryCommands(program)

	return program
}

/** Run the CLI with the given argv */
export async function runCli(argv: string[]): Promise<void> {
	const program = createCli()
	await program.parseAsync(argv)
}
