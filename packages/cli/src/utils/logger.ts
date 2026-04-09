import pc from 'picocolors'

/**
 * Consistent CLI output utilities used across every command.
 *
 * Symbol convention:
 *   ▲  brand mark + headers
 *   ›  step / bullet
 *   ✓  success
 *   ✗  error
 *   ⚠  warning
 *   ℹ  info / hint
 *   ─  separator
 *
 * Every line starts with two spaces of indent so the output sits in a
 * clean visual column instead of running into the terminal edge.
 */

const INDENT = '  '

/**
 * Print the NextVM brand banner once at the top of long-running commands.
 * Includes the package version so users know what they're running.
 */
export function printBanner(version: string, subtitle?: string): void {
	const tag = pc.dim(`v${version}`)
	const sub = subtitle ? `\n${INDENT}${pc.dim(subtitle)}` : ''
	console.log(
		`\n${INDENT}${pc.bold(pc.cyan('▲ NextVM'))} ${tag}${sub}\n`,
	)
}

/**
 * Print a section header with a horizontal rule below.
 */
export function printHeader(title: string): void {
	console.log(`\n${INDENT}${pc.bold(title)}`)
	console.log(`${INDENT}${pc.dim('─'.repeat(Math.max(title.length, 8)))}\n`)
}

export const cliLog = {
	/** General info — neutral cyan */
	info: (msg: string) => console.log(`${INDENT}${pc.cyan('ℹ')} ${msg}`),

	/** Operation succeeded */
	success: (msg: string) => console.log(`${INDENT}${pc.green('✓')} ${msg}`),

	/** Non-fatal warning */
	warn: (msg: string) => console.warn(`${INDENT}${pc.yellow('⚠')} ${msg}`),

	/** Fatal error */
	error: (msg: string) => console.error(`${INDENT}${pc.red('✗')} ${msg}`),

	/** Numbered or bulleted step the user should run */
	step: (msg: string) => console.log(`${INDENT}${pc.dim('›')} ${msg}`),

	/** Section header — bold + spacing */
	header: (msg: string) => printHeader(msg),

	/** Brand banner with version */
	banner: (version: string, subtitle?: string) => printBanner(version, subtitle),

	/** Plain dimmed text */
	dim: (msg: string) => console.log(`${INDENT}${pc.dim(msg)}`),

	/** Plain text with indent */
	plain: (msg: string) => console.log(`${INDENT}${msg}`),

	/** Empty line for vertical breathing room */
	br: () => console.log(),
}

/**
 * Format a `key: value` pair with right-aligned key for table-like output.
 */
export function formatKv(key: string, value: string, keyWidth = 14): string {
	return `${pc.dim(key.padEnd(keyWidth))}${value}`
}
