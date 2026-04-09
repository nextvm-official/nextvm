import pc from 'picocolors'

/**
 * Simple CLI logger with colored output.
 * Used by all command implementations.
 */
export const cliLog = {
	info: (msg: string) => console.log(pc.cyan('ℹ'), msg),
	success: (msg: string) => console.log(pc.green('✓'), msg),
	warn: (msg: string) => console.warn(pc.yellow('⚠'), msg),
	error: (msg: string) => console.error(pc.red('✗'), msg),
	step: (msg: string) => console.log(pc.dim('→'), msg),
	header: (msg: string) => console.log(`\n${pc.bold(pc.cyan(msg))}\n`),
}
